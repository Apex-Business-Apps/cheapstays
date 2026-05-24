import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dispatchNotification } from "../_shared/notify.ts";
import {
  flowToCoarseStatus,
  isTransitionAllowed,
  recordTransition,
  type FlowState,
} from "../_shared/booking-transitions.ts";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(3).max(2000).optional(),
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
    const rl = await rateLimit(`decline-replacement:${ip}`, 20, 60_000);
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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("id, guest_id, host_id, flow_state")
      .eq("id", parsed.data.booking_id)
      .single();
    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    if (booking.guest_id !== user.id) {
      return json({ error: "Only the guest may decline a replacement" }, 403);
    }

    const fromState = booking.flow_state as FlowState;
    const toState: FlowState = "cancel_requested";
    if (!isTransitionAllowed(fromState, toState)) {
      return json({ error: `Cannot decline replacement from state '${fromState}'` }, 409);
    }

    const { error: updateError } = await adminClient
      .from("bookings")
      .update({
        flow_state: toState,
        status: flowToCoarseStatus(toState),
        cancelled_at: new Date().toISOString(),
        cancellation_reason: parsed.data.reason ?? "Guest declined replacement",
      })
      .eq("id", booking.id);

    if (updateError) return json({ error: "Failed to decline replacement", detail: updateError.message }, 500);

    await recordTransition(adminClient, {
      bookingId: booking.id,
      fromState,
      toState,
      actorUserId: user.id,
      actorRole: "guest",
      reason: "guest_declined_replacement",
      metadata: { decline_reason: parsed.data.reason ?? null },
    });

    await dispatchNotification(adminClient, {
      userId: booking.host_id,
      type: "booking_status_changed",
      title: "Guest declined replacement",
      body: "The guest declined your replacement offer. Refund will be processed.",
      data: { booking_id: booking.id, flow_state: toState },
      url: "/host?tab=bookings",
    });

    return json({ success: true, booking_id: booking.id, flow_state: toState });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
