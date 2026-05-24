import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PAYMONGO_WEBHOOK_SECRET_HEADER = "paymongo-signature";

async function verifySignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [k, v] = segment.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = parts["t"];
  const receivedSig = parts["li"] ?? parts["te"];
  if (!timestamp || !receivedSig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === receivedSig;
}

type BookingRow = {
  id: string;
  status: string;
  payment_status: string;
  payment_state: string | null;
};

function isTransitionAllowed(eventType: string, booking: BookingRow): boolean {
  const { payment_status, status } = booking;
  switch (eventType) {
    case "payment.paid":
      return payment_status !== "paid" && status !== "cancelled";
    case "payment.failed":
      return payment_status !== "paid" && payment_status !== "refunded";
    case "refund.succeeded":
      return payment_status === "paid";
    case "payout.pending":
    case "payout.paid":
      return true;
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

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sigHeader = req.headers.get(PAYMONGO_WEBHOOK_SECRET_HEADER) ?? "";
    if (!(await verifySignature(rawBody, sigHeader, webhookSecret))) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    const eventId: string | undefined = event?.data?.id;
    const eventType: string | undefined = event?.data?.attributes?.type;
    const attrs = event?.data?.attributes?.data?.attributes;
    const paymentIntentId: string | undefined = attrs?.payment_intent_id;
    const bookingId: string | undefined = attrs?.metadata?.booking_id;

    if (!eventId || !eventType) {
      return new Response(
        JSON.stringify({ received: true, skipped: "missing event id or type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Idempotency check ────────────────────────────────────────────────────
    const { data: existing } = await adminClient
      .from("webhook_events")
      .select("id")
      .eq("provider", "paymongo")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ received: true, skipped: "duplicate event", event_id: eventId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Resolve booking ──────────────────────────────────────────────────────
    let booking: BookingRow | null = null;

    if (bookingId) {
      const { data } = await adminClient
        .from("bookings")
        .select("id,status,payment_status,payment_state")
        .eq("id", bookingId)
        .maybeSingle();
      booking = data ?? null;
    }

    if (!booking && paymentIntentId) {
      const { data } = await adminClient
        .from("bookings")
        .select("id,status,payment_status,payment_state")
        .eq("paymongo_payment_intent_id", paymentIntentId)
        .maybeSingle();
      booking = data ?? null;
    }

    if (!booking) {
      await adminClient.from("webhook_events").insert({
        provider: "paymongo",
        event_id: eventId,
        event_type: eventType,
        booking_id: null,
      });
      return new Response(
        JSON.stringify({ received: true, skipped: "booking not resolved", event_id: eventId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build update payload ─────────────────────────────────────────────────
    const updates: Record<string, unknown> = {};
    if (eventType === "payment.paid")     Object.assign(updates, { payment_status: "paid", payment_state: "captured", status: "confirmed" });
    if (eventType === "payment.failed")   Object.assign(updates, { payment_status: "failed", payment_state: "failed" });
    if (eventType === "refund.succeeded") Object.assign(updates, { payment_status: "refunded", payment_state: "refunded" });
    if (eventType === "payout.pending")   Object.assign(updates, { payment_state: "payout_on_hold" });
    if (eventType === "payout.paid")      Object.assign(updates, { payment_state: "payout_released" });

    if (Object.keys(updates).length === 0) {
      await adminClient.from("webhook_events").insert({
        provider: "paymongo",
        event_id: eventId,
        event_type: eventType,
        booking_id: booking.id,
      });
      return new Response(
        JSON.stringify({ received: true, skipped: `unhandled event: ${eventType}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── State-machine guard ──────────────────────────────────────────────────
    if (!isTransitionAllowed(eventType, booking)) {
      await adminClient.from("webhook_events").insert({
        provider: "paymongo",
        event_id: eventId,
        event_type: eventType,
        booking_id: booking.id,
      });
      return new Response(
        JSON.stringify({
          received: true,
          skipped: "transition not allowed",
          current_state: { status: booking.status, payment_status: booking.payment_status },
          event_type: eventType,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Apply update ─────────────────────────────────────────────────────────
    const { error: updateErr } = await adminClient
      .from("bookings")
      .update(updates)
      .eq("id", booking.id);
    if (updateErr) throw updateErr;

    // ── Record as processed ──────────────────────────────────────────────────
    await adminClient.from("webhook_events").insert({
      provider: "paymongo",
      event_id: eventId,
      event_type: eventType,
      booking_id: booking.id,
    });

    return new Response(
      JSON.stringify({ received: true, booking_id: booking.id, updates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
