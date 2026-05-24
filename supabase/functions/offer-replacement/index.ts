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
  replacement_listing_id: z.string().uuid(),
  replacement_check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  replacement_check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  host_notes: z.string().max(2000).optional(),
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
    const rl = await rateLimit(`offer-replacement:${ip}`, 20, 60_000);
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
      .select("id, host_id, guest_id, flow_state")
      .eq("id", parsed.data.booking_id)
      .single();
    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    if (booking.host_id !== user.id) {
      return json({ error: "Only the host may offer a replacement" }, 403);
    }

    const fromState = booking.flow_state as FlowState;
    const toState: FlowState = "replacement_offered";
    if (!isTransitionAllowed(fromState, toState)) {
      return json({ error: `Cannot offer replacement from state '${fromState}'` }, 409);
    }

    const { error: updateError } = await adminClient
      .from("bookings")
      .update({
        flow_state: toState,
        status: flowToCoarseStatus(toState),
        host_notes: parsed.data.host_notes ?? null,
      })
      .eq("id", booking.id);

    if (updateError) return json({ error: "Failed to record replacement offer", detail: updateError.message }, 500);

    await recordTransition(adminClient, {
      bookingId: booking.id,
      fromState,
      toState,
      actorUserId: user.id,
      actorRole: "host",
      reason: "host_offered_replacement",
      metadata: {
        replacement_listing_id: parsed.data.replacement_listing_id,
        replacement_check_in: parsed.data.replacement_check_in,
        replacement_check_out: parsed.data.replacement_check_out,
        host_notes: parsed.data.host_notes ?? null,
      },
    });

    await dispatchNotification(adminClient, {
      userId: booking.guest_id,
      type: "booking_status_changed",
      title: "Replacement stay offered",
      body: "The host offered a replacement stay. Review the details and accept or decline.",
      data: {
        booking_id: booking.id,
        flow_state: toState,
        replacement_listing_id: parsed.data.replacement_listing_id,
      },
      url: "/my-bookings",
    });

    return json({ success: true, booking_id: booking.id, flow_state: toState });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
