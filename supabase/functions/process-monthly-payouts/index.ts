// Triggered: pg_cron on 1st of month at 01:00 UTC (09:00 Manila)
// Action: batch payout all eligible wallets via Xendit Disbursements

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decrypt } from '../_shared/encryption.ts';

const MINIMUM_PAYOUT = 500; // PHP ₱500 minimum

serve(async (req) => {
  // Verify this is an internal call
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader?.includes(serviceKey)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey
  );

  const now = new Date();
  const cycleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Fetch all eligible wallets (available >= ₱500, not frozen)
  const { data: wallets } = await supabase
    .from('host_wallets')
    .select(`
      id, host_id, available_balance,
      host_payout_accounts (
        payout_method, account_holder_name, account_number_enc
      )
    `)
    .gte('available_balance', MINIMUM_PAYOUT)
    .eq('is_frozen', false);

  if (!wallets || wallets.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: 'No eligible wallets' }));
  }

  const results = { processed: 0, failed: 0, skipped: 0 };

  for (const wallet of wallets) {
    const payoutAccount = wallet.host_payout_accounts?.[0];

    if (!payoutAccount) {
      results.skipped++;
      continue;
    }

    // Check if already processed this cycle
    const { data: existing } = await supabase
      .from('disbursement_requests')
      .select('id')
      .eq('wallet_id', wallet.id)
      .eq('cycle_month', cycleMonth)
      .single();

    if (existing) { results.skipped++; continue; }

    const amount = Number(wallet.available_balance);
    const accountNumber = await decrypt(payoutAccount.account_number_enc);

    // Create disbursement request record
    const { data: disbRequest } = await supabase
      .from('disbursement_requests')
      .insert({
        wallet_id: wallet.id,
        amount,
        status: 'processing',
        payout_method: payoutAccount.payout_method,
        account_details_enc: payoutAccount.account_number_enc,
        cycle_month: cycleMonth,
        requested_at: now.toISOString()
      })
      .select('id')
      .single();

    try {
      // Call Xendit Disbursements API
      const xenditRes = await fetch('https://api.xendit.co/disbursements', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(Deno.env.get('XENDIT_SECRET_KEY')! + ':')}`,
          'Content-Type': 'application/json',
          'Idempotency-key': `cheapstays-${wallet.id}-${cycleMonth}`
        },
        body: JSON.stringify({
          external_id: `cheapstays-${wallet.id}-${cycleMonth}`,
          amount,
          bank_code: payoutAccount.payout_method,
          account_holder_name: payoutAccount.account_holder_name,
          account_number: accountNumber,
          description: `CheapStays host payout ${cycleMonth}`
        })
      });

      const xenditData = await xenditRes.json();

      if (!xenditRes.ok) throw new Error(xenditData.message || 'Xendit error');

      // Debit wallet immediately on Xendit acceptance
      await supabase.from('host_wallets').update({
        available_balance: 0
      }).eq('id', wallet.id);

      await supabase.from('disbursement_requests').update({
        status: 'processing',
        xendit_disbursement_id: xenditData.id,
        xendit_reference_id: xenditData.external_id
      }).eq('id', disbRequest!.id);

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'debit_disbursement',
        amount,
        status: 'completed',
        disbursement_id: disbRequest!.id,
        xendit_reference_id: xenditData.id,
        description: `Monthly payout ${cycleMonth}`
      });

      results.processed++;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Mark as failed, restore balance, schedule retry
      await supabase.from('disbursement_requests').update({
        status: 'failed',
        failure_reason: errorMessage,
        retry_count: 1,
        retry_after: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      }).eq('id', disbRequest!.id);

      results.failed++;
    }
  }

  return new Response(JSON.stringify({ cycleMonth, ...results }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
