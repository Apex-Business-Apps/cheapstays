/**
 * Edge function: auto-approve-long-term-requests
 *
 * Internal — called by pg_cron via pg_net. Requires service_role Authorization.
 *
 * Feature-flag-gated: only runs when LONG_TERM_AUTO_APPROVAL_ENABLED=true.
 * When enabled, transitions bookings with flow_state='requested' that have
 * been sitting past AUTO_APPROVE_AFTER_HOURS (default 12) to 'auto_approved'.
 *
 * No-op when the flag is disabled — pg_cron still ticks but the function
 * returns immediately. This avoids accidental enablement at the DB layer.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { recordTransition, flowToCoarseStatus } from "../_shared/booking-transitions.ts";
import { dispatchNotification } from "../_shared/notify.ts";

const DEFAULT_AUTO_APPROVE_AFTER_HOURS = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const enabled = Deno.env.get("LONG_TERM_AUTO_APPROVAL_ENABLED") === "true";
  if (!enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "flag_disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const hoursRaw = Deno.env.get("AUTO_APPROVE_AFTER_HOURS");
  const hours = hoursRaw ? Math.max(1, parseInt(hoursRaw, 10) || DEFAULT_AUTO_APPROVE_AFTER_HOURS) : DEFAULT_AUTO_APPROVE_AFTER_HOURS;

  const supabase: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data: stale, error: qErr } = await supabase
    .from("bookings")
    .select("id, guest_id, host_id, listing_id")
    .eq("flow_state", "requested")
    .lt("created_at", cutoff);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const approved: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const b of stale ?? []) {
    const { error: uErr } = await supabase
      .from("bookings")
      .update({ flow_state: "auto_approved", status: flowToCoarseStatus("auto_approved") })
      .eq("id", b.id)
      .eq("flow_state", "requested");
    if (uErr) {
      failed.push({ id: b.id, error: uErr.message });
      continue;
    }
    try {
      await recordTransition(supabase, {
        bookingId: b.id,
        fromState: "requested",
        toState: "auto_approved",
        actorUserId: null,
        actorRole: "scheduler",
        reason: "auto_approval_threshold_passed",
        metadata: { auto_approve_after_hours: hours },
      });
    } catch (err) {
      failed.push({ id: b.id, error: (err as Error).message });
      continue;
    }
    await dispatchNotification(supabase, {
      userId: b.guest_id,
      type: "long_term_request_auto_approved",
      title: "Your long-term request was auto-approved",
      body: "Complete payment to confirm your reservation.",
      data: { booking_id: b.id, listing_id: b.listing_id },
    }).catch(() => { /* best-effort */ });
    approved.push(b.id);
  }

  return new Response(JSON.stringify({ approved, failed, scanned: stale?.length ?? 0, hours }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
