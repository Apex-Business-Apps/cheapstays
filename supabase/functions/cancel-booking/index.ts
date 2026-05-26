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
    const key = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!key) return new Response(JSON.stringify({ error: "PAYMONGO_SECRET_KEY required" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const res = await fetch("https://api.paymongo.com/v1/refunds", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${key}:`)}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ data: { attributes: { amount: Math.round(Number(booking.total_php) * 100), payment_id: booking.paymongo_payment_id, reason: "requested_by_customer" } } }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: "Refund failed", detail: data }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    await adminClient.from("bookings").update({ payment_status: "refunded", refunded_at: new Date().toISOString(), refund_ref: data?.data?.id ?? null, updated_at: new Date().toISOString() }).eq("id", booking_id);
    await adminClient.from("payment_audit_log").insert({ booking_id, event_type: "refunded", actor_user_id: user.id, paymongo_ref: data?.data?.id ?? null, amount_centavos: Math.round(Number(booking.total_php) * 100) });
    return new Response(JSON.stringify({ ok: true, status: "refunded" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Booking is not cancellable" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
