/**
 * Edge function: expire-pending-long-term-requests
 *
 * Internal — called by pg_cron via pg_net. Requires service_role Authorization.
 *
 * Scans bookings with flow_state='requested' whose approval_deadline_at has
 * passed, transitions them to 'expired', updates coarse status to 'cancelled',
 * and dispatches a host_response_timeout notification to the guest.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { recordTransition, flowToCoarseStatus } from "../_shared/booking-transitions.ts";
import { dispatchNotification } from "../_shared/notify.ts";

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

  const supabase: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const now = new Date().toISOString();

  const { data: expiring, error: qErr } = await supabase
    .from("bookings")
    .select("id, guest_id, host_id, listing_id")
    .eq("flow_state", "requested")
    .lt("approval_deadline_at", now);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expired: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const b of expiring ?? []) {
    const { error: uErr } = await supabase
      .from("bookings")
      .update({ flow_state: "expired", status: flowToCoarseStatus("expired") })
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
        toState: "expired",
        actorUserId: null,
        actorRole: "scheduler",
        reason: "host_response_deadline_passed",
      });
    } catch (err) {
      failed.push({ id: b.id, error: (err as Error).message });
      continue;
    }
    await dispatchNotification(supabase, {
      userId: b.guest_id,
      type: "long_term_request_expired",
      title: "Your long-term request expired",
      body: "The host did not respond within 24 hours. Please look for another stay.",
      data: { booking_id: b.id, listing_id: b.listing_id },
    }).catch(() => { /* best-effort */ });
    expired.push(b.id);
  }

  return new Response(JSON.stringify({ expired, failed, scanned: expiring?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
