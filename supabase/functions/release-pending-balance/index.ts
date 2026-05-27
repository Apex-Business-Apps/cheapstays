// Triggered: guest checkout confirmed / stay completed
// Action: move pending_balance → available_balance for that booking's earnings

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLATFORM_FEE_RATE = 0.10;

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { booking_id } = await req.json();
  if (!booking_id) return new Response('Missing booking_id', { status: 400 });

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, host_id, total_amount')
    .eq('id', booking_id)
    .single();

  if (!booking) return new Response('Booking not found', { status: 404 });

  const hostEarnings = Number(booking.total_amount) * (1 - PLATFORM_FEE_RATE);

  const { data: wallet } = await supabase
    .from('host_wallets')
    .select('id, available_balance, pending_balance')
    .eq('host_id', booking.host_id)
    .single();

  if (!wallet) return new Response('Wallet not found', { status: 404 });

  const newPending = Math.max(0, Number(wallet.pending_balance) - hostEarnings);
  const newAvailable = Number(wallet.available_balance) + hostEarnings;

  await supabase.from('host_wallets').update({
    pending_balance: newPending,
    available_balance: newAvailable
  }).eq('id', wallet.id);

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'release_to_available',
    amount: hostEarnings,
    status: 'completed',
    booking_id: booking_id,
    description: `Stay completed — funds released to available`
  });

  return new Response(JSON.stringify({ success: true, released: hostEarnings }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
