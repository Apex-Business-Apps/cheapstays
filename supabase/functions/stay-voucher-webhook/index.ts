import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  PAYMONGO_SIGNATURE_HEADER, parsePaymongoEvent,
  SUPPORTED_PAYMONGO_EVENTS, verifyPaymongoSignature,
} from "../_shared/paymongo-webhook.ts";

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_CODE_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genCode(): string {
  const raw = new Uint8Array(8);
  crypto.getRandomValues(raw);
  const chars = Array.from(raw, (b) => CROCKFORD[b % CROCKFORD.length]).join("");
  return `CS-${chars.slice(0,4)}-${chars.slice(4,8)}`;
}

async function sendEmail(purchaseId: string, buyerEmail: string, batchName: string, codes: string[], validUntil: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const html = `
    <h2>Your CheapStays voucher${codes.length > 1 ? "s" : ""}</h2>
    <p><strong>${batchName}</strong></p>
    <p>Valid until <strong>${new Date(validUntil).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}</strong>.</p>
    <ul>${codes.map((c) => `<li style="font-family:monospace;font-size:20px">${c}</li>`).join("")}</ul>
    <p>Show your code to the host at check-in. Save this email — codes are non-refundable.</p>
    <p style="color:#888;font-size:12px">Reference: ${purchaseId.slice(0,8)}</p>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CheapStays <no-reply@cheapstays.me>",
      to: [buyerEmail],
      subject: `Your CheapStays voucher — ${codes[0]}${codes.length > 1 ? ` +${codes.length - 1} more` : ""}`,
      html,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secrets = [
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
    .select("id, batch_id, quantity, buyer_email, payment_status")
    .eq("id", purchaseId ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (!purchase && sessionId) {
    const fb = await admin.from("stay_voucher_purchases")
      .select("id, batch_id, quantity, buyer_email, payment_status")
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

  const paidAt = new Date().toISOString();
  await admin.from("stay_voucher_purchases")
    .update({ payment_status: "paid", paid_at: paidAt })
    .eq("id", purchase.id);

  const { data: batch } = await admin
    .from("stay_voucher_batches")
    .select("id, batch_name, valid_days")
    .eq("id", purchase.batch_id).single();

  const validUntil = new Date(Date.now() + batch!.valid_days * 86_400_000).toISOString();
  const codes: string[] = [];
  for (let i = 0; i < purchase.quantity; i++) {
    let attempts = 0;
    while (attempts < MAX_CODE_ATTEMPTS) {
      const code = genCode();
      const { error } = await admin.from("stay_voucher_codes").insert({
        batch_id: purchase.batch_id, code, purchase_id: purchase.id, valid_until: validUntil,
      });
      if (!error) { codes.push(code); break; }
      if (!error.message.toLowerCase().includes("duplicate")) {
        console.error("code insert failed:", error);
        break;
      }
      attempts++;
    }
  }

  try {
    if (codes.length === 0) {
      console.error("stay-voucher-webhook: no codes minted for purchase", purchase.id);
    } else {
      await sendEmail(purchase.id, purchase.buyer_email, batch!.batch_name, codes, validUntil);
    }
  } catch (err) { console.error("resend send (non-fatal):", err); }

  // Notify admins in-app (best-effort — no admin ids known here; skip if not applicable).
  await record();
  return json({ received: true, processed: true, purchase_id: purchase.id, codes_minted: codes.length }, 200);
});
