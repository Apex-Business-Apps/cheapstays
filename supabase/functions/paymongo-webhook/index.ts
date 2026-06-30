import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { extractBookingId, PAYMONGO_SIGNATURE_HEADER, parsePaymongoEvent, SUPPORTED_PAYMONGO_EVENTS, verifyPaymongoSignature } from "../_shared/paymongo-webhook.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Accept either the test- or live-mode signing secret so the same endpoint
  // works in both PayMongo modes without swapping env vars. PAYMONGO_WEBHOOK_SECRET
  // is kept for backwards-compatibility; *_TEST / *_LIVE are the explicit ones.
  const secrets = [
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET_TEST"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET_LIVE"),
  ].filter((s): s is string => !!s);
  if (secrets.length === 0) return json({ error: "No PayMongo webhook secret configured" }, 500);

  const rawBody = await req.text();
  const signatureHeader = req.headers.get(PAYMONGO_SIGNATURE_HEADER) ?? "";
  let signatureOk = false;
  for (const secret of secrets) {
    if (await verifyPaymongoSignature(rawBody, signatureHeader, secret, 300)) { signatureOk = true; break; }
  }
  if (!signatureOk) return json({ error: "Invalid signature" }, 403);

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let eventId: string, eventType: string, payload: ReturnType<typeof parsePaymongoEvent>["payload"];
  try {
    ({ eventId, eventType, payload } = parsePaymongoEvent(rawBody));
  } catch (err) {
    return json({ received: true, ignored: "unparseable", detail: (err as Error).message }, 200);
  }

  // Idempotency — return 2xx (not 409) so PayMongo doesn't flag duplicates as failed deliveries.
  const { data: duplicate } = await adminClient
    .from("webhook_events").select("id").eq("provider", "paymongo").eq("event_id", eventId).maybeSingle();
  if (duplicate) return json({ received: true, duplicate: true, event_id: eventId }, 200);

  const recordEvent = async (bookingId: string | null) => {
    // Best-effort audit row; never let a webhook_events schema mismatch 500 the webhook.
    try {
      await adminClient.from("webhook_events").insert({ provider: "paymongo", event_id: eventId, event_type: eventType, booking_id: bookingId });
    } catch (err) { console.error("webhook_events insert failed (non-fatal):", err); }
  };

  if (!SUPPORTED_PAYMONGO_EVENTS.has(eventType)) {
    await recordEvent(null);
    return json({ received: true, ignored: `unsupported event: ${eventType}` }, 200);
  }

  const bookingId = extractBookingId(payload);
  if (!bookingId) {
    await recordEvent(null);
    return json({ received: true, ignored: "no booking_id in metadata" }, 200);
  }

  // resource id = cs_… (checkout session); the captured payment id is nested under payments[].
  type PayMongoResource = {
    id?: string;
    attributes?: {
      payments?: Array<{ id?: string }>;
      payment_id?: string;
    };
  };
  const resource = (payload as { data?: { attributes?: { data?: PayMongoResource } } })?.data?.attributes?.data;
  const paymentId: string | null = resource?.attributes?.payments?.[0]?.id ?? resource?.attributes?.payment_id ?? resource?.id ?? null;

  // Resolve booking — prefer metadata id, fall back to the stored checkout-session id.
  let { data: booking } = await adminClient
    .from("bookings").select("id,status,payment_status").eq("id", bookingId).maybeSingle();
  if (!booking && resource?.id) {
    const fallback = await adminClient
      .from("bookings").select("id,status,payment_status").eq("payment_ref", resource.id).maybeSingle();
    booking = fallback.data ?? null;
  }

  if (!booking) {
    await recordEvent(null);
    return json({ received: true, ignored: "booking not found", booking_id: bookingId }, 200);
  }

  // Idempotent state guard — already paid or cancelled: acknowledge, don't re-update.
  if (booking.payment_status === "paid" || booking.status === "cancelled") {
    await recordEvent(booking.id);
    return json({ received: true, skipped: "already settled", booking_id: booking.id }, 200);
  }

  // ── Authoritative booking update (covers payment_status AND status so the
  //    "Resume payment" CTA clears). Done inline so it doesn't depend on the
  //    process_paymongo_paid_webhook RPC, which may be missing on this project. ──
  const { error: updateErr } = await adminClient
    .from("bookings")
    .update({
      payment_status: "paid",
      payment_state: "captured",
      status: "confirmed",
      paid_at: new Date().toISOString(),
      ...(paymentId ? { paymongo_payment_id: paymentId } : {}),
    })
    .eq("id", booking.id);
  if (updateErr) return json({ error: "Failed to update booking", detail: updateErr.message }, 500);

  await recordEvent(booking.id);

  // Best-effort: payment audit + host wallet credit. Neither should fail the webhook.
  try {
    await adminClient.from("payment_audit_log").insert({
      booking_id: booking.id, event_type: "paid", paymongo_ref: paymentId, metadata: { event_id: eventId },
    });
  } catch (err) { console.error("payment_audit_log insert failed (non-fatal):", err); }

  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/credit-host-wallet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: booking.id }),
    });
  } catch (err) { console.error("credit-host-wallet error (non-fatal):", err); }

  return json({ received: true, processed: true, booking_id: booking.id }, 200);
});
