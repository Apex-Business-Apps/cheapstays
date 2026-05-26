import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  client_amount: z.number().int().positive().optional(),
});

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function paymongoHeaders(secretKey: string, idempotencyKey: string): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const rl = await rateLimit(`payment-intent:${req.headers.get("x-forwarded-for") ?? "anon"}`, 5, 60_000);
    if (!rl.ok) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymongoKey) return new Response(JSON.stringify({ error: "PAYMONGO_SECRET_KEY is required" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { booking_id, client_amount } = parsed.data;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking } = await adminClient
      .from("bookings")
      .select("id,guest_id,listing_id,check_in,check_out,nights,payment_status,status")
      .eq("id", booking_id)
      .eq("guest_id", user.id)
      .single();
    if (!booking) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: listing } = await adminClient.from("listings").select("id,nightly_php,title").eq("id", booking.listing_id).single();
    if (!listing) return new Response(JSON.stringify({ error: "Listing not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const computedAmount = Math.round(Number(listing.nightly_php) * Number(booking.nights) * 100);
    if (typeof client_amount === "number" && client_amount !== computedAmount) {
      console.error("payment amount mismatch", { booking_id, client_amount, computedAmount, user_id: user.id });
      return new Response(JSON.stringify({ error: "Amount mismatch" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const idempotencyKey = crypto.randomUUID();
    const payload = {
      data: {
        attributes: {
          amount: computedAmount,
          currency: "PHP",
          payment_method_types: ["gcash", "paymaya", "card"],
          reference_number: booking_id,
          success_url: `${Deno.env.get("APP_URL") ?? "http://localhost:5173"}/booking/success?session_id={id}`,
          cancel_url: `${Deno.env.get("APP_URL") ?? "http://localhost:5173"}/booking/cancel?booking_id=${booking_id}`,
          metadata: { booking_id, user_id: user.id, listing_id: booking.listing_id },
        },
      },
    };

    const res = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, { method: "POST", headers: paymongoHeaders(paymongoKey, idempotencyKey), body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: "Failed to create checkout session", detail: data }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await adminClient.from("bookings").update({ payment_provider: "paymongo", paymongo_checkout_session_id: data?.data?.id, paymongo_idempotency_key: idempotencyKey, payment_status: "pending" }).eq("id", booking_id);
    await adminClient.from("payment_audit_log").insert({ booking_id, event_type: "intent_created", paymongo_ref: data?.data?.id ?? null, amount_centavos: computedAmount, actor_user_id: user.id, metadata: { object: "checkout_session" } });

    return new Response(JSON.stringify({ checkout_session_id: data?.data?.id, checkout_url: data?.data?.attributes?.checkout_url, success_url: payload.data.attributes.success_url, cancel_url: payload.data.attributes.cancel_url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
