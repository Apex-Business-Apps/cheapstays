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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === receivedSig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    if (webhookSecret) {
      const sigHeader = req.headers.get(PAYMONGO_WEBHOOK_SECRET_HEADER) ?? "";
      if (!(await verifySignature(rawBody, sigHeader, webhookSecret))) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;
    const attrs = event?.data?.attributes?.data?.attributes;
    const paymentIntentId = attrs?.payment_intent_id;
    const bookingId = attrs?.metadata?.booking_id;

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let resolvedBookingId: string | null = bookingId ?? null;
    if (!resolvedBookingId && paymentIntentId) {
      const { data: found } = await adminClient.from("bookings").select("id").eq("paymongo_payment_intent_id", paymentIntentId).maybeSingle();
      resolvedBookingId = found?.id ?? null;
    }
    if (!resolvedBookingId) return new Response(JSON.stringify({ received: true, skipped: "booking not resolved" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const updates: Record<string, unknown> = {};
    if (eventType === "payment.paid") Object.assign(updates, { payment_status: "paid", payment_state: "captured", status: "confirmed" });
    if (eventType === "payment.failed") Object.assign(updates, { payment_status: "failed", payment_state: "failed" });
    if (eventType === "refund.succeeded") Object.assign(updates, { payment_status: "refunded", payment_state: "refunded" });
    if (eventType === "payout.pending") Object.assign(updates, { payment_state: "payout_on_hold" });
    if (eventType === "payout.paid") Object.assign(updates, { payment_state: "payout_released" });

    if (Object.keys(updates).length === 0) return new Response(JSON.stringify({ received: true, skipped: `unhandled event: ${eventType}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await adminClient.from("bookings").update(updates).eq("id", resolvedBookingId);
    return new Response(JSON.stringify({ received: true, booking_id: resolvedBookingId, updates }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
