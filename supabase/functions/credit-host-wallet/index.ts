// Triggered: booking confirmed (call from existing booking confirmation flow)
// Action: credit host's pending_balance for the booking amount minus platform fee

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLATFORM_FEE_RATE = 0.10; // 10% platform cut — adjust if different

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { booking_id } = await req.json();
  if (!booking_id) return new Response('Missing booking_id', { status: 400 });

  // Fetch booking with host and amount
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, host_id, total_amount, status')
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  if (booking.status !== 'confirmed') {
    return new Response(JSON.stringify({ error: 'Booking not confirmed' }), { status: 400 });
  }

  const hostEarnings = Number(booking.total_amount) * (1 - PLATFORM_FEE_RATE);

  // Upsert wallet (create if first booking)
  const { data: wallet, error: walletError } = await supabase
    .from('host_wallets')
    .upsert({ host_id: booking.host_id }, { onConflict: 'host_id' })
    .select('id, pending_balance, is_frozen')
    .single();

  if (walletError || !wallet) {
    return new Response(JSON.stringify({ error: 'Wallet upsert failed' }), { status: 500 });
  }

  if (wallet.is_frozen) {
    return new Response(JSON.stringify({ error: 'Wallet is frozen' }), { status: 403 });
  }

  // Credit pending balance
  const { error: updateError } = await supabase
    .from('host_wallets')
    .update({ pending_balance: Number(wallet.pending_balance) + hostEarnings })
    .eq('id', wallet.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Balance update failed' }), { status: 500 });
  }

  // Log transaction
  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'credit_pending',
    amount: hostEarnings,
    status: 'completed',
    booking_id: booking_id,
    description: `Booking confirmed — pending credit`
  });

  return new Response(JSON.stringify({ success: true, credited: hostEarnings }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
