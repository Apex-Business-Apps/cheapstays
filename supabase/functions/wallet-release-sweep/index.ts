/**
 * Edge function: wallet-release-sweep
 *
 * Internal — called by pg_cron via pg_net (daily). Requires service_role Authorization.
 *
 * Sweeps every paid booking whose payout window has elapsed
 * (`payout_release_on <= now()`) and hasn't had its host wallet credit released
 * yet, and moves the host's earnings from `pending_balance` → `available_balance`
 * in one transaction per booking. This is what makes money withdrawable via
 * `request-disbursement`.
 *
 * Idempotent: presence of a `release_to_available` row in `wallet_transactions`
 * for a given booking is the guard — matches `release-pending-balance/index.ts`.
 * Safe to run repeatedly; a booking will only be released once.
 *
 * Batching: caps at BATCH_LIMIT per invocation to keep a single cron run under
 * the edge function CPU budget. Under normal load the queue is well below the
 * cap; a large backlog will drain across successive cron runs.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PLATFORM_FEE_RATE = 0.10;
const BATCH_LIMIT = 200;

type EligibleBooking = {
  id: string;
  host_id: string;
  total_php: number;
  payout_release_on: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return json(401, { error: "Unauthorized" });
  }

  const supabase: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Candidates: paid bookings past their payout window, in an active or completed state.
  const nowIso = new Date().toISOString();
  const { data: candidates, error: qErr } = await supabase
    .from("bookings")
    .select("id, host_id, total_php, payout_release_on")
    .eq("payment_status", "paid")
    .in("status", ["confirmed", "completed"])
    .lte("payout_release_on", nowIso)
    .order("payout_release_on", { ascending: true })
    .limit(BATCH_LIMIT);

  if (qErr) return json(500, { error: qErr.message });

  const eligible = (candidates ?? []) as EligibleBooking[];
  if (eligible.length === 0) return json(200, { swept: 0, released: 0, released_php: 0 });

  // Filter out any already released — cheaper than joining upfront.
  const bookingIds = eligible.map((b) => b.id);
  const { data: alreadyReleased } = await supabase
    .from("wallet_transactions")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("type", "release_to_available");
  const releasedSet = new Set((alreadyReleased ?? []).map((r) => r.booking_id));
  const toRelease = eligible.filter((b) => !releasedSet.has(b.id));

  let released = 0;
  let releasedPhp = 0;
  const errors: { booking_id: string; error: string }[] = [];

  for (const booking of toRelease) {
    const hostEarnings = round2(Number(booking.total_php) * (1 - PLATFORM_FEE_RATE));

    // Load wallet fresh per booking so concurrent credit/release don't clobber balances.
    const { data: wallet, error: walletErr } = await supabase
      .from("host_wallets")
      .select("id, available_balance, pending_balance, is_frozen")
      .eq("host_id", booking.host_id)
      .maybeSingle();

    if (walletErr) {
      errors.push({ booking_id: booking.id, error: `wallet lookup: ${walletErr.message}` });
      continue;
    }
    if (!wallet) {
      errors.push({ booking_id: booking.id, error: "wallet missing (host has no wallet row)" });
      continue;
    }

    const newPending = Math.max(0, round2(Number(wallet.pending_balance) - hostEarnings));
    const newAvailable = round2(Number(wallet.available_balance) + hostEarnings);

    const { error: updateErr } = await supabase
      .from("host_wallets")
      .update({ pending_balance: newPending, available_balance: newAvailable })
      .eq("id", wallet.id);

    if (updateErr) {
      errors.push({ booking_id: booking.id, error: `balance update: ${updateErr.message}` });
      continue;
    }

    const { error: ledgerErr } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "release_to_available",
      amount: hostEarnings,
      status: "completed",
      booking_id: booking.id,
      description: "Payout window elapsed — funds released to available (sweeper)",
    });

    if (ledgerErr) {
      // Balance already moved. Log — reconciliation surface should catch this.
      errors.push({ booking_id: booking.id, error: `ledger insert (balance already moved): ${ledgerErr.message}` });
      continue;
    }

    released++;
    releasedPhp = round2(releasedPhp + hostEarnings);
  }

  return json(200, {
    swept: eligible.length,
    skipped_already_released: eligible.length - toRelease.length,
    released,
    released_php: releasedPhp,
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
