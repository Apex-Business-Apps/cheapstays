import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({ booking_id: z.string().uuid(), reason: z.string().max(500).optional() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`cancel-booking:${ip}`, 3, 60_000);
  if (!rl.ok) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { booking_id, reason } = parsed.data;
  const { data: booking } = await adminClient.from("bookings").select("id,guest_id,payment_status,total_php,paymongo_payment_id").eq("id", booking_id).single();
  if (!booking) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (booking.guest_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (booking.payment_status === "pending") {
    await adminClient.from("bookings").update({ payment_status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", booking_id);
    await adminClient.from("payment_audit_log").insert({ booking_id, event_type: "cancelled", actor_user_id: user.id, metadata: { reason: reason ?? null } });
    return new Response(JSON.stringify({ ok: true, status: "cancelled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (booking.payment_status === "paid") {
    // Paid booking refunds must flow through cancel-booking-guest + process-refund
    // so state checks and policy-based refund calculations are enforced server-side.
    return new Response(JSON.stringify({ error: "Use the standard cancellation flow for paid bookings" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Booking is not cancellable" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
