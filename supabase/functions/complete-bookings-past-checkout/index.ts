/**
 * Edge function: complete-bookings-past-checkout
 *
 * Internal — called by pg_cron via pg_net. Requires service_role Authorization.
 *
 * Scans bookings with flow_state='active' whose check_out date is strictly
 * before today, transitions them to 'completed', updates coarse status, and
 * notifies both guest and host.
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
  const today = new Date().toISOString().slice(0, 10);

  const { data: pastCheckout, error: qErr } = await supabase
    .from("bookings")
    .select("id, guest_id, host_id, listing_id")
    .eq("flow_state", "active")
    .lt("check_out", today);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const completed: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const b of pastCheckout ?? []) {
    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("bookings")
      .update({
        flow_state: "completed",
        status: flowToCoarseStatus("completed"),
        completed_at: now,
      })
      .eq("id", b.id)
      .eq("flow_state", "active");
    if (uErr) {
      failed.push({ id: b.id, error: uErr.message });
      continue;
    }
    try {
      await recordTransition(supabase, {
        bookingId: b.id,
        fromState: "active",
        toState: "completed",
        actorUserId: null,
        actorRole: "scheduler",
        reason: "checkout_date_passed",
      });
    } catch (err) {
      failed.push({ id: b.id, error: (err as Error).message });
      continue;
    }
    await Promise.allSettled([
      dispatchNotification(supabase, {
        userId: b.guest_id,
        type: "booking_completed",
        title: "Your stay is complete",
        body: "Hope you enjoyed your stay. Leave a review to help future guests.",
        data: { booking_id: b.id, listing_id: b.listing_id },
      }),
      dispatchNotification(supabase, {
        userId: b.host_id,
        type: "booking_completed",
        title: "Booking completed",
        body: "The guest has checked out. Your payout will be released shortly.",
        data: { booking_id: b.id, listing_id: b.listing_id },
      }),
    ]);
    completed.push(b.id);
  }

  return new Response(JSON.stringify({ completed, failed, scanned: pastCheckout?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
