import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { buildRefundWindow, isProviderAllowed, validatePaymentMethod } from "../_shared/payments.ts";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  provider: z.string().default("paymongo"),
  payment_method: z.string(),
  requires_incidental_hold: z.boolean().default(true),
  hold: z.boolean().default(false),
});

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function paymongoHeaders(secretKey: string): Record<string, string> {
  return { Authorization: `Basic ${btoa(`${secretKey}:`)}`, "Content-Type": "application/json", Accept: "application/json" };
}

async function paymongoPost(path: string, body: unknown, secretKey: string) {
  const res = await fetch(`${PAYMONGO_BASE}${path}`, { method: "POST", headers: paymongoHeaders(secretKey), body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rl = await rateLimit(`payment-intent:${req.headers.get("x-forwarded-for") ?? "anon"}`, 5, 60_000);
    if (!rl.ok) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { booking_id, provider, payment_method, requires_incidental_hold, hold } = parsed.data;
    if (!isProviderAllowed(provider)) return new Response(JSON.stringify({ error: "Provider blocked pending legal approval" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const methodCheck = validatePaymentMethod(payment_method, requires_incidental_hold);
    if (!methodCheck.ok) return new Response(JSON.stringify({ error: methodCheck.reason }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: booking } = await adminClient.from("bookings").select("id, listing_id, guest_id, check_in, check_out, total_php, status, payment_status").eq("id", booking_id).eq("guest_id", user.id).single();
    if (!booking) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!['pending', 'confirmed'].includes(booking.status) || booking.payment_status !== 'unpaid') return new Response(JSON.stringify({ error: "Booking is not payable" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: listing } = await adminClient.from("listings").select("title").eq("id", booking.listing_id).single();
    const refundWindow = buildRefundWindow(booking.check_in);

    if (provider === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return new Response(JSON.stringify({ error: "Stripe not configured" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const stripeClient = new Stripe(stripeKey, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      });
      const pi = await stripeClient.paymentIntents.create({
        amount: Math.round(Number(booking.total_php) * 100), // PHP centavos
        currency: "php",
        automatic_payment_methods: { enabled: true },
        description: `CheapStays booking: ${listing?.title ?? "property"} (${booking.check_in} to ${booking.check_out})`,
        metadata: { booking_id },
      });
      await adminClient.from("bookings").update({
        payment_provider: "stripe",
        stripe_payment_intent_id: pi.id,
        payment_method,
        payment_state: "intent_created",
        payment_status: "pending",
        refundable_until: refundWindow.refundable_until,
        payout_release_on: refundWindow.payout_release_on,
      }).eq("id", booking_id);
      return new Response(
        JSON.stringify({ payment_intent_id: pi.id, client_secret: pi.client_secret, provider: "stripe", refund_window: refundWindow }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymongoKey) return new Response(JSON.stringify({ error: "PayMongo not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Card hold: manual capture, card-only. GCash/Maya don't support pre-auth.
    const captureType = hold && payment_method === "card" ? "manual" : "automatic";
    const allowedMethods = captureType === "manual" ? ["card"] : ["card", "gcash", "paymaya"];
    const intentPayload = { data: { attributes: { amount: Math.round(Number(booking.total_php) * 100), payment_method_allowed: allowedMethods, payment_method_options: { card: { request_three_d_secure: "any" } }, currency: "PHP", capture_type: captureType, description: `CheapStays booking: ${listing?.title ?? "property"} (${booking.check_in} to ${booking.check_out})`, metadata: { booking_id } } } };
    const intentRes = await paymongoPost("/payment_intents", intentPayload, paymongoKey);
    if (!intentRes.ok) return new Response(JSON.stringify({ error: "Failed to create payment intent", detail: intentRes.data }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const intentData = intentRes.data as { data: { id: string; attributes: { client_key: string } } };
    await adminClient.from("bookings").update({ payment_provider: "paymongo", paymongo_payment_intent_id: intentData.data.id, payment_method, payment_state: "intent_created", payment_status: "pending", refundable_until: refundWindow.refundable_until, payout_release_on: refundWindow.payout_release_on }).eq("id", booking_id);
    return new Response(JSON.stringify({ payment_intent_id: intentData.data.id, client_key: intentData.data.attributes.client_key, provider: "paymongo", refund_window: refundWindow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
