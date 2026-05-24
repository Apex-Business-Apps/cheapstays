import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dispatchNotification } from "../_shared/notify.ts";
import {
  flowToCoarseStatus,
  recordTransition,
  type FlowState,
} from "../_shared/booking-transitions.ts";

// process-refund finalizes a refund after a cancel/replacement-decline has
// already moved the booking to cancel_requested. It does NOT call PayMongo
// directly — refund initiation lives in the existing payment-intent /
// payment-webhook surfaces. This function records the final state transition
// and notifies the guest. Tier-aware penalty math (Phase 8) is the only
// thing that decides how much was refunded; the amount is passed in.

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  refunded_amount_php: z.number().nonnegative(),
  service_fee_retained_php: z.number().nonnegative(),
  accommodation_penalty_php: z.number().nonnegative(),
  refund_tier: z.enum(["full", "partial_10", "partial_30", "zero"]),
  provider_refund_ref: z.string().max(200).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`process-refund:${ip}`, 30, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Only admins (or service-role webhooks via direct invocation) may
    // finalize a refund. Hosts and guests cannot self-serve refund amounts.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin role required to finalize a refund" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("id, guest_id, host_id, flow_state, payment_state")
      .eq("id", parsed.data.booking_id)
      .single();
    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    const fromState = booking.flow_state as FlowState;
    if (fromState !== "cancel_requested") {
      return json({ error: `Refund can only be finalized from 'cancel_requested', got '${fromState}'` }, 409);
    }

    const toState: FlowState = "refunded";
    const { error: updateError } = await adminClient
      .from("bookings")
      .update({
        flow_state: toState,
        status: flowToCoarseStatus(toState),
        payment_state: parsed.data.refunded_amount_php > 0 ? "refunded" : booking.payment_state,
        payment_status: parsed.data.refunded_amount_php > 0 ? "refunded" : undefined,
      })
      .eq("id", booking.id);

    if (updateError) return json({ error: "Failed to record refund", detail: updateError.message }, 500);

    await recordTransition(adminClient, {
      bookingId: booking.id,
      fromState,
      toState,
      actorUserId: user.id,
      actorRole: "admin",
      reason: "admin_finalized_refund",
      metadata: {
        refund_tier: parsed.data.refund_tier,
        refunded_amount_php: parsed.data.refunded_amount_php,
        service_fee_retained_php: parsed.data.service_fee_retained_php,
        accommodation_penalty_php: parsed.data.accommodation_penalty_php,
        provider_refund_ref: parsed.data.provider_refund_ref ?? null,
        legal_compliance_tag: "ph_consumer_protection",
      },
    });

    await dispatchNotification(adminClient, {
      userId: booking.guest_id,
      type: "refund_processed",
      title: "Refund processed",
      body: `₱${parsed.data.refunded_amount_php.toLocaleString()} has been refunded to your original payment method.`,
      data: { booking_id: booking.id, refund_tier: parsed.data.refund_tier },
      url: "/my-bookings",
    });

    return json({
      success: true,
      booking_id: booking.id,
      flow_state: toState,
      refunded_amount_php: parsed.data.refunded_amount_php,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
