// Receives Xendit webhook callbacks for disbursement status updates

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // Verify Xendit webhook token
  const webhookToken = req.headers.get('x-callback-token');
  if (webhookToken !== Deno.env.get('XENDIT_WEBHOOK_TOKEN')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const payload = await req.json();
  const { external_id, status, id: xendit_id, failure_code } = payload;

  // Find disbursement request by xendit reference
  const { data: disbRequest } = await supabase
    .from('disbursement_requests')
    .select('id, wallet_id, amount, retry_count')
    .eq('xendit_disbursement_id', xendit_id)
    .single();

  if (!disbRequest) return new Response('Not found', { status: 404 });

  if (status === 'COMPLETED') {
    await supabase.from('disbursement_requests').update({
      status: 'completed',
      processed_at: new Date().toISOString()
    }).eq('id', disbRequest.id);
  }

  if (status === 'FAILED') {
    const retryCount = disbRequest.retry_count || 0;

    if (retryCount < 1) {
      // First failure — schedule retry in 48 hours
      await supabase.from('disbursement_requests').update({
        status: 'retrying',
        failure_reason: failure_code,
        retry_count: retryCount + 1,
        retry_after: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      }).eq('id', disbRequest.id);

      // Restore balance for retry
      const { data: wallet } = await supabase
        .from('host_wallets')
        .select('available_balance')
        .eq('id', disbRequest.wallet_id)
        .single();

      await supabase.from('host_wallets').update({
        available_balance: Number(wallet?.available_balance || 0) + disbRequest.amount
      }).eq('id', disbRequest.wallet_id);

      await supabase.from('wallet_transactions').insert({
        wallet_id: disbRequest.wallet_id,
        type: 'debit_failed_reversal',
        amount: disbRequest.amount,
        status: 'completed',
        disbursement_id: disbRequest.id,
        description: `Payout failed — balance restored. Retry scheduled.`
      });

    } else {
      // Max retries exceeded — mark failed, notify host via database flag
      await supabase.from('disbursement_requests').update({
        status: 'failed',
        failure_reason: `Max retries exceeded. Last error: ${failure_code}`,
        processed_at: new Date().toISOString()
      }).eq('id', disbRequest.id);

      // Restore balance so host can update account details
      const { data: wallet } = await supabase
        .from('host_wallets')
        .select('available_balance')
        .eq('id', disbRequest.wallet_id)
        .single();

      await supabase.from('host_wallets').update({
        available_balance: Number(wallet?.available_balance || 0) + disbRequest.amount
      }).eq('id', disbRequest.wallet_id);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
