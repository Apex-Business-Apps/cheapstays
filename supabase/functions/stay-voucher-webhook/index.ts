import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  PAYMONGO_SIGNATURE_HEADER, parsePaymongoEvent,
  SUPPORTED_PAYMONGO_EVENTS, verifyPaymongoSignature,
} from "../_shared/paymongo-webhook.ts";
import { markPaidAndMintCodes } from "../_shared/stay-voucher-mint.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Use STAY_VOUCHER-specific secrets so this webhook doesn't collide with the
  // booking webhook's PAYMONGO_WEBHOOK_SECRET* env vars. PayMongo issues a
  // unique signing secret per endpoint, so voucher and booking webhooks each
  // have their own. We fall back to the shared vars only for backwards
  // compatibility during initial setup.
  const secrets = [
    Deno.env.get("PAYMONGO_STAY_VOUCHER_WEBHOOK_SECRET"),
    Deno.env.get("PAYMONGO_STAY_VOUCHER_WEBHOOK_SECRET_TEST"),
    Deno.env.get("PAYMONGO_STAY_VOUCHER_WEBHOOK_SECRET_LIVE"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET_TEST"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET_LIVE"),
  ].filter((s): s is string => !!s);
  if (!secrets.length) return json({ error: "No PayMongo webhook secret configured" }, 500);

  const rawBody = await req.text();
  const signatureHeader = req.headers.get(PAYMONGO_SIGNATURE_HEADER) ?? "";
  let sigOk = false;
  for (const s of secrets) {
    if (await verifyPaymongoSignature(rawBody, signatureHeader, s, 300)) { sigOk = true; break; }
  }
  if (!sigOk) return json({ error: "Invalid signature" }, 403);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let eventId: string, eventType: string, payload: ReturnType<typeof parsePaymongoEvent>["payload"];
  try {
    ({ eventId, eventType, payload } = parsePaymongoEvent(rawBody));
  } catch (err) {
    return json({ received: true, ignored: "unparseable", detail: (err as Error).message }, 200);
  }

  const { data: duplicate } = await admin
    .from("webhook_events").select("id")
    .eq("provider", "paymongo_stay_voucher").eq("event_id", eventId).maybeSingle();
  if (duplicate) return json({ received: true, duplicate: true }, 200);

  const record = async () => {
    try {
      await admin.from("webhook_events").insert({
        provider: "paymongo_stay_voucher",
        event_id: eventId, event_type: eventType,
        booking_id: null, // voucher webhooks don't reference bookings
      });
    } catch (err) { console.error("webhook_events insert (non-fatal):", err); }
  };

  if (!SUPPORTED_PAYMONGO_EVENTS.has(eventType)) {
    await record();
    return json({ received: true, ignored: eventType }, 200);
  }

  const resource = (payload as { data?: { attributes?: { data?: {
    id?: string;
    attributes?: { metadata?: Record<string,string>; payments?: Array<{ id?: string }> };
  } } } })?.data?.attributes?.data;
  const purchaseId = resource?.attributes?.metadata?.purchase_id;
  const sessionId  = resource?.id;
  if (!purchaseId && !sessionId) {
    await record();
    return json({ received: true, ignored: "no purchase_id" }, 200);
  }

  let { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, payment_status")
    .eq("id", purchaseId ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (!purchase && sessionId) {
    const fb = await admin.from("stay_voucher_purchases")
      .select("id, payment_status")
      .eq("payment_ref", sessionId).maybeSingle();
    purchase = fb.data;
  }
  if (!purchase) {
    await record();
    return json({ received: true, ignored: "purchase not found" }, 200);
  }
  if (purchase.payment_status === "paid") {
    await record();
    return json({ received: true, skipped: "already paid" }, 200);
  }

  const result = await markPaidAndMintCodes(admin, purchase.id);
  await record();
  return json({
    received: true, processed: true, purchase_id: purchase.id,
    codes_minted: result.minted, already_paid: result.alreadyPaid,
  }, 200);
});
