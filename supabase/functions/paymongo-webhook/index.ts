import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { extractBookingId, PAYMONGO_SIGNATURE_HEADER, parsePaymongoEvent, SUPPORTED_PAYMONGO_EVENTS, verifyPaymongoSignature } from "../_shared/paymongo-webhook.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  if (!webhookSecret) return new Response(JSON.stringify({ error: "PAYMONGO_WEBHOOK_SECRET missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const rawBody = await req.text();
  const signatureHeader = req.headers.get(PAYMONGO_SIGNATURE_HEADER) ?? "";
  if (!(await verifyPaymongoSignature(rawBody, signatureHeader, webhookSecret))) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { eventId, eventType, payload } = parsePaymongoEvent(rawBody);

  const { data: duplicate } = await adminClient.from("webhook_events").select("id").eq("provider", "paymongo").eq("event_id", eventId).maybeSingle();
  if (duplicate) return new Response(JSON.stringify({ error: "Duplicate event" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!SUPPORTED_PAYMONGO_EVENTS.has(eventType)) {
    await adminClient.from("webhook_events").insert({ provider: "paymongo", event_id: eventId, event_type: eventType, processed_at: new Date().toISOString() });
    return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const bookingId = extractBookingId(payload);
  if (!bookingId) return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // transaction via rpc to keep booking + webhook insert atomic
  const { error } = await adminClient.rpc("process_paymongo_paid_webhook", {
    p_booking_id: bookingId,
    p_event_id: eventId,
    p_event_type: eventType,
    p_payment_id: payload?.data?.attributes?.data?.id ?? null,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  await adminClient.from("payment_audit_log").insert({ booking_id: bookingId, event_type: "paid", paymongo_ref: payload?.data?.attributes?.data?.id ?? null, metadata: { event_id: eventId } });

  return new Response(JSON.stringify({ received: true, processed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
