import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

// Booking state-machine: define which (payment_status, status) pairs allow
// each incoming event to mutate the booking. Prevents replayed or out-of-order
// events from corrupting already-settled bookings.
type BookingRow = {
  id: string;
  status: string;
  payment_status: string;
  payment_state: string | null;
};

function isTransitionAllowed(event: string, booking: BookingRow): boolean {
  const { payment_status, status } = booking;
  switch (event) {
    case "payment_intent.succeeded":
      // Only apply if not already paid or cancelled.
      return payment_status !== "paid" && status !== "cancelled";
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      // Only apply if payment has not already succeeded or been refunded.
      return payment_status !== "paid" && payment_status !== "refunded";
    case "charge.captured":
      return payment_status !== "paid";
    case "charge.refunded":
      // Only refund a booking that was paid.
      return payment_status === "paid";
    case "charge.expired":
      return payment_status !== "paid" && payment_status !== "refunded";
    default:
      return true;
  }
}

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

  // ── Idempotency check ────────────────────────────────────────────────────────
  // Stripe retries events on 5xx or timeout. We record every processed event_id
  // so duplicate deliveries are acknowledged but not re-applied.
  const { data: existing } = await admin
    .from("webhook_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ received: true, skipped: "duplicate event", event_id: event.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Resolve booking ──────────────────────────────────────────────────────────
  async function findBooking(piId?: string, metadataBookingId?: string): Promise<BookingRow | null> {
    if (metadataBookingId) {
      const { data } = await admin
        .from("bookings")
        .select("id,status,payment_status,payment_state")
        .eq("id", metadataBookingId)
        .maybeSingle();
      return data ?? null;
    }
    if (!piId) return null;
    const { data } = await admin
      .from("bookings")
      .select("id,status,payment_status,payment_state")
      .eq("stripe_payment_intent_id", piId)
      .maybeSingle();
    return data ?? null;
  }

  const updates: Record<string, unknown> = {};
  let booking: BookingRow | null = null;

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        booking = await findBooking(pi.id, pi.metadata?.booking_id);
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
        booking = await findBooking(pi.id, pi.metadata?.booking_id);
        Object.assign(updates, { payment_status: "failed", payment_state: "failed" });
        break;
      }
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        booking = await findBooking(pi.id, pi.metadata?.booking_id);
        Object.assign(updates, { payment_status: "failed", payment_state: "cancelled" });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        booking = await findBooking(
          typeof ch.payment_intent === "string" ? ch.payment_intent : undefined,
          ch.metadata?.booking_id,
        );
        Object.assign(updates, { payment_status: "refunded", payment_state: "refunded" });
        break;
      }
      case "charge.captured": {
        const ch = event.data.object as Stripe.Charge;
        booking = await findBooking(
          typeof ch.payment_intent === "string" ? ch.payment_intent : undefined,
          ch.metadata?.booking_id,
        );
        Object.assign(updates, { payment_state: "captured", payment_status: "paid" });
        break;
      }
      case "charge.expired": {
        const ch = event.data.object as Stripe.Charge;
        booking = await findBooking(
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

    if (!booking) {
      // Still record so we don't process this unknown event repeatedly.
      await admin.from("webhook_events").insert({
        provider: "stripe",
        event_id: event.id,
        event_type: event.type,
        booking_id: null,
      });
      return new Response(
        JSON.stringify({ received: true, skipped: "booking not resolved", event_id: event.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── State-machine guard ───────────────────────────────────────────────────
    if (!isTransitionAllowed(event.type, booking)) {
      await admin.from("webhook_events").insert({
        provider: "stripe",
        event_id: event.id,
        event_type: event.type,
        booking_id: booking.id,
      });
      return new Response(
        JSON.stringify({
          received: true,
          skipped: "transition not allowed",
          current_state: { status: booking.status, payment_status: booking.payment_status },
          event_type: event.type,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Apply update ─────────────────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from("bookings")
      .update(updates)
      .eq("id", booking.id);
    if (updateErr) throw updateErr;

    // ── Record as processed (after successful update) ─────────────────────────
    await admin.from("webhook_events").insert({
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      booking_id: booking.id,
    });

    return new Response(
      JSON.stringify({ received: true, booking_id: booking.id, type: event.type }),
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
