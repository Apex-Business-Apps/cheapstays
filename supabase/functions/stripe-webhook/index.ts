import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sig = req.headers.get("stripe-signature");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !whSecret) {
    return new Response(JSON.stringify({ error: "Missing signature or webhook secret" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, whSecret);
  } catch (err) {
    return new Response(JSON.stringify({ error: `Invalid signature: ${(err as Error).message}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  async function findBookingId(piId?: string, metadataBookingId?: string): Promise<string | null> {
    if (metadataBookingId) return metadataBookingId;
    if (!piId) return null;
    const { data } = await admin
      .from("bookings")
      .select("id")
      .eq("stripe_payment_intent_id", piId)
      .maybeSingle();
    return data?.id ?? null;
  }

  const updates: Record<string, unknown> = {};
  let bookingId: string | null = null;

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        bookingId = await findBookingId(pi.id, pi.metadata?.booking_id);
        Object.assign(updates, {
          payment_status: "paid",
          payment_state: "captured",
          status: "confirmed",
          payment_provider: "stripe",
          stripe_payment_intent_id: pi.id,
          confirmed_at: new Date().toISOString(),
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        bookingId = await findBookingId(pi.id, pi.metadata?.booking_id);
        Object.assign(updates, { payment_status: "failed", payment_state: "failed" });
        break;
      }
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        bookingId = await findBookingId(pi.id, pi.metadata?.booking_id);
        Object.assign(updates, { payment_status: "failed", payment_state: "cancelled" });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        bookingId = await findBookingId(
          typeof ch.payment_intent === "string" ? ch.payment_intent : undefined,
          ch.metadata?.booking_id,
        );
        Object.assign(updates, { payment_status: "refunded", payment_state: "refunded" });
        break;
      }
      case "charge.captured": {
        const ch = event.data.object as Stripe.Charge;
        bookingId = await findBookingId(
          typeof ch.payment_intent === "string" ? ch.payment_intent : undefined,
          ch.metadata?.booking_id,
        );
        Object.assign(updates, { payment_state: "captured", payment_status: "paid" });
        break;
      }
      case "charge.expired": {
        const ch = event.data.object as Stripe.Charge;
        bookingId = await findBookingId(
          typeof ch.payment_intent === "string" ? ch.payment_intent : undefined,
          ch.metadata?.booking_id,
        );
        Object.assign(updates, { payment_state: "expired" });
        break;
      }
      default:
        return new Response(
          JSON.stringify({ received: true, skipped: `unhandled: ${event.type}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (!bookingId) {
      return new Response(
        JSON.stringify({ received: true, skipped: "booking not resolved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await admin.from("bookings").update(updates).eq("id", bookingId);
    if (error) throw error;

    return new Response(
      JSON.stringify({ received: true, booking_id: bookingId, type: event.type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("stripe-webhook error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});