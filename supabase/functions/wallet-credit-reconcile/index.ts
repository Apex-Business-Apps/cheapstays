/**
 * Edge function: wallet-credit-reconcile
 *
 * Internal — called by pg_cron via pg_net (daily, ~30 min before
 * wallet-release-sweep). Requires service_role Authorization.
 *
 * Safety net for `credit-host-wallet`. The PayMongo webhook fires that function
 * fire-and-forget (see paymongo-webhook/index.ts:119-124), so a transient error
 * silently leaves the booking `payment_status='paid'` with no `credit_pending`
 * ledger row and no `pending_balance` movement. This reconciler finds those
 * dropped bookings and credits them.
 *
 * Idempotent: presence of a `credit_pending` row in `wallet_transactions` for
 * a given booking is the guard — matches `credit-host-wallet/index.ts:43-55`.
 * Safe to run repeatedly; a booking will only be credited once.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PLATFORM_FEE_RATE = 0.10;
const BATCH_LIMIT = 200;

type Booking = { id: string; host_id: string; total_php: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return json(401, { error: "Unauthorized" });
  }

  const supabase: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Candidate paid+confirmed bookings — same gate as credit-host-wallet:37.
  const { data: candidates, error: qErr } = await supabase
    .from("bookings")
    .select("id, host_id, total_php")
    .eq("payment_status", "paid")
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (qErr) return json(500, { error: qErr.message });

  const eligible = (candidates ?? []) as Booking[];
  if (eligible.length === 0) return json(200, { swept: 0, credited: 0, credited_php: 0 });

  const bookingIds = eligible.map((b) => b.id);
  const { data: alreadyCredited } = await supabase
    .from("wallet_transactions")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("type", "credit_pending");
  const creditedSet = new Set((alreadyCredited ?? []).map((r) => r.booking_id));
  const toCredit = eligible.filter((b) => !creditedSet.has(b.id));

  let credited = 0;
  let creditedPhp = 0;
  const errors: { booking_id: string; error: string }[] = [];

  for (const booking of toCredit) {
    const hostEarnings = round2(Number(booking.total_php) * (1 - PLATFORM_FEE_RATE));

    // Upsert wallet — creates one if the host is new.
    const { data: wallet, error: walletErr } = await supabase
      .from("host_wallets")
      .upsert({ host_id: booking.host_id }, { onConflict: "host_id" })
      .select("id, pending_balance, is_frozen")
      .single();

    if (walletErr || !wallet) {
      errors.push({ booking_id: booking.id, error: `wallet upsert: ${walletErr?.message ?? "no wallet"}` });
      continue;
    }
    if (wallet.is_frozen) {
      errors.push({ booking_id: booking.id, error: "wallet is frozen" });
      continue;
    }

    const newPending = round2(Number(wallet.pending_balance) + hostEarnings);
    const { error: updateErr } = await supabase
      .from("host_wallets")
      .update({ pending_balance: newPending })
      .eq("id", wallet.id);

    if (updateErr) {
      errors.push({ booking_id: booking.id, error: `balance update: ${updateErr.message}` });
      continue;
    }

    const { error: ledgerErr } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "credit_pending",
      amount: hostEarnings,
      status: "completed",
      booking_id: booking.id,
      description: "Booking confirmed — pending credit (reconciled)",
    });

    if (ledgerErr) {
      errors.push({ booking_id: booking.id, error: `ledger insert (balance already moved): ${ledgerErr.message}` });
      continue;
    }

    credited++;
    creditedPhp = round2(creditedPhp + hostEarnings);
  }

  return json(200, {
    swept: eligible.length,
    skipped_already_credited: eligible.length - toCredit.length,
    credited,
    credited_php: creditedPhp,
    errors,
  });
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
