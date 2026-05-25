import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  extractBookingId,
  PAYMONGO_SIGNATURE_HEADER,
  parsePaymongoEvent,
  SUPPORTED_PAYMONGO_EVENTS,
  verifyPaymongoSignature,
} from "../_shared/paymongo-webhook.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing server configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get(PAYMONGO_SIGNATURE_HEADER) ?? "";

  // PayMongo webhook docs (Notifications/Webhooks): header=paymongo-signature,
  // payload signed with HMAC-SHA256 over `${timestamp}.${raw_body}` using endpoint secret.
  if (!(await verifyPaymongoSignature(rawBody, signatureHeader, webhookSecret))) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let eventId = "";
  let eventType = "";
  let payload: import("../_shared/paymongo-webhook.ts").PaymongoEventEnvelope;
  try {
    const parsed = parsePaymongoEvent(rawBody);
    eventId = parsed.eventId;
    eventType = parsed.eventType;
    payload = parsed.payload;
  } catch {
    return new Response(JSON.stringify({ error: "Malformed webhook payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: duplicate } = await adminClient
    .from("webhook_events")
    .select("id")
    .eq("provider", "paymongo")
    .eq("event_id", eventId)
    .maybeSingle();

  if (duplicate) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bookingId = extractBookingId(payload);

  const recordEvent = async (status: "processed" | "ignored" | "error", error: string | null = null) => {
    await adminClient.from("webhook_events").insert({
      provider: "paymongo",
      event_id: eventId,
      event_type: eventType,
      booking_id: bookingId,
      processed_at: new Date().toISOString(),
    });
    if (error) console.error("paymongo-webhook", { event_id: eventId, status, error });
  };

  if (!SUPPORTED_PAYMONGO_EVENTS.has(eventType)) {
    await recordEvent("ignored");
    return new Response(JSON.stringify({ received: true, ignored: true, reason: "unsupported_event" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (eventType !== "checkout_session.payment.paid") {
    await recordEvent("ignored");
    return new Response(JSON.stringify({ received: true, ignored: true, reason: "event_not_implemented" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!bookingId) {
    await recordEvent("ignored");
    return new Response(JSON.stringify({ received: true, ignored: true, reason: "missing_booking_id" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: booking } = await adminClient
    .from("bookings")
    .select("id,payment_status,payment_state,paymongo_payment_intent_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    await recordEvent("ignored");
    return new Response(JSON.stringify({ received: true, ignored: true, reason: "booking_not_found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    payment_state: "captured",
  };

  const paymentIntentId = payload?.data?.attributes?.data?.attributes?.payment_intent_id;
  if (typeof paymentIntentId === "string" && paymentIntentId.length > 0) {
    updatePayload.paymongo_payment_intent_id = paymentIntentId;
  }

  const { error: updateError } = await adminClient.from("bookings").update(updatePayload).eq("id", bookingId);
  if (updateError) {
    await recordEvent("error", updateError.message);
    return new Response(JSON.stringify({ error: "Failed to update booking" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await recordEvent("processed");

  return new Response(JSON.stringify({ received: true, processed: true, booking_id: bookingId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
