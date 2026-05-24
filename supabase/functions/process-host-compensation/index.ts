import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dispatchNotification } from "../_shared/notify.ts";
import { recordTransition } from "../_shared/booking-transitions.ts";

// process-host-compensation records the platform→host payout of the host's
// 70% share of an accommodation penalty retained on a guest-initiated
// cancellation. The actual money movement is owned by the existing PayMongo
// payout pipeline — this function records the booking_transitions audit row
// + notifies the host. It does NOT alter flow_state; the booking is already
// in 'refunded' by the time compensation is computed.

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  accommodation_penalty_php: z.number().nonnegative(),
  host_share_php: z.number().nonnegative(),
  platform_share_php: z.number().nonnegative(),
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

    // Locked policy: host gets 70%, platform gets 30% of the retained
    // accommodation penalty. The caller computes amounts; we verify the
    // split sums correctly and rejects mismatched payloads.
    const sum = parsed.data.host_share_php + parsed.data.platform_share_php;
    if (Math.abs(sum - parsed.data.accommodation_penalty_php) > 1) {
      return json(
        { error: "host_share + platform_share must equal accommodation_penalty (±1 php tolerance)" },
        400,
      );
    }

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("id, host_id, flow_state")
      .eq("id", parsed.data.booking_id)
      .single();
    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    if (booking.flow_state !== "refunded") {
      return json({ error: `Host compensation requires flow_state='refunded', got '${booking.flow_state}'` }, 409);
    }

    // Booking-level metadata is captured in the transition row. No flow_state
    // change — the booking remains in 'refunded'. metadata.subtype lets the
    // admin timeline distinguish compensation from the original refund.
    await recordTransition(adminClient, {
      bookingId: booking.id,
      fromState: "refunded",
      toState: "refunded",
      actorUserId: user.id,
      actorRole: "admin",
      reason: "platform_paid_host_cancellation_penalty",
      metadata: {
        subtype: "host_compensation",
        accommodation_penalty_php: parsed.data.accommodation_penalty_php,
        host_share_php: parsed.data.host_share_php,
        platform_share_php: parsed.data.platform_share_php,
        provider_payout_ref: parsed.data.provider_payout_ref ?? null,
        legal_compliance_tag: "ph_host_compensation",
      },
    });

    await dispatchNotification(adminClient, {
      userId: booking.host_id,
      type: "payout_released",
      title: "Cancellation compensation paid",
      body: `Your 70% share of the cancellation penalty (₱${parsed.data.host_share_php.toLocaleString()}) has been paid out.`,
      data: { booking_id: booking.id },
      url: "/host?tab=bookings",
    });

    return json({
      success: true,
      booking_id: booking.id,
      host_share_php: parsed.data.host_share_php,
      platform_share_php: parsed.data.platform_share_php,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
