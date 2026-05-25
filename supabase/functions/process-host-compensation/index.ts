import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dispatchNotification } from "../_shared/notify.ts";
import { recordTransition } from "../_shared/booking-transitions.ts";
import { calculateRefundAmounts, type RefundTier } from "../_shared/payments.ts";

// process-host-compensation records the platform→host payout of the host's
// 70% share of an accommodation penalty retained on a guest-initiated
// cancellation. Amounts are computed server-side from the booking's check_in
// + total_php using the same calculator process-refund used, so the audit
// row is internally consistent.

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  refund_tier: z.enum(["full", "partial_10", "partial_30", "zero"]).optional(),
  provider_payout_ref: z.string().max(200).optional(),
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
    const rl = await rateLimit(`host-compensation:${ip}`, 30, 60_000);
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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin role required to process host compensation" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("id, host_id, flow_state, check_in, total_php")
      .eq("id", parsed.data.booking_id)
      .single();
    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    if (booking.flow_state !== "refunded") {
      return json({ error: `Host compensation requires flow_state='refunded', got '${booking.flow_state}'` }, 409);
    }

    const breakdown = calculateRefundAmounts(
      booking.check_in,
      booking.total_php,
      parsed.data.refund_tier as RefundTier | undefined,
    );

    if (breakdown.penalty_php <= 0) {
      return json({ error: "No accommodation penalty was retained — no compensation owed.", tier: breakdown.tier }, 409);
    }

    await recordTransition(adminClient, {
      bookingId: booking.id,
      fromState: "refunded",
      toState: "refunded",
      actorUserId: user.id,
      actorRole: "admin",
      reason: "platform_paid_host_cancellation_penalty",
      metadata: {
        subtype: "host_compensation",
        refund_tier: breakdown.tier,
        accommodation_penalty_php: breakdown.penalty_php,
        host_share_php: breakdown.host_share_php,
        platform_share_php: breakdown.platform_share_php,
        provider_payout_ref: parsed.data.provider_payout_ref ?? null,
        legal_compliance_tag: "ph_host_compensation",
      },
    });

    await dispatchNotification(adminClient, {
      userId: booking.host_id,
      type: "payout_released",
      title: "Cancellation compensation paid",
      body: `Your 70% share of the cancellation penalty (₱${breakdown.host_share_php.toLocaleString()}) has been paid out.`,
      data: { booking_id: booking.id },
      url: "/host?tab=bookings",
    });

    return json({
      success: true,
      booking_id: booking.id,
      host_share_php: breakdown.host_share_php,
      platform_share_php: breakdown.platform_share_php,
      refund_tier: breakdown.tier,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
