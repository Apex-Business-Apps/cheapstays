// Shared helper for marking a stay-voucher purchase paid, minting its codes,
// and emailing the buyer. Used by both stay-voucher-webhook (regular happy
// path) and stay-voucher-purchase-lookup (self-heal path when the webhook
// hasn't fired). Idempotent: safe to call twice; the second call is a no-op.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_CODE_ATTEMPTS = 5;

function genCode(): string {
  const raw = new Uint8Array(8);
  crypto.getRandomValues(raw);
  const chars = Array.from(raw, (b) => CROCKFORD[b % CROCKFORD.length]).join("");
  return `CS-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

async function sendEmail(
  purchaseId: string,
  buyerEmail: string,
  batchName: string,
  codes: string[],
  validUntil: string,
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || codes.length === 0) return;
  const validDate = new Date(validUntil).toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });
  const html = `
    <h2>Your CheapStays voucher${codes.length > 1 ? "s" : ""}</h2>
    <p><strong>${batchName}</strong></p>
    <p>Valid until <strong>${validDate}</strong>.</p>
    <ul>${codes.map((c) => `<li style="font-family:monospace;font-size:20px">${c}</li>`).join("")}</ul>
    <p>Show your code to the host at check-in. Save this email — codes are non-refundable.</p>
    <p style="color:#888;font-size:12px">Reference: ${purchaseId.slice(0, 8)}</p>
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

export async function markPaidAndMintCodes(
  admin: Admin,
  purchaseId: string,
): Promise<{ minted: number; alreadyPaid: boolean; skipped?: string }> {
  const { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, batch_id, quantity, buyer_email, payment_status")
    .eq("id", purchaseId).maybeSingle();
  if (!purchase) return { minted: 0, alreadyPaid: false, skipped: "purchase_not_found" };
  if (purchase.payment_status === "paid") return { minted: 0, alreadyPaid: true };

  const paidAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("stay_voucher_purchases")
    .update({ payment_status: "paid", paid_at: paidAt })
    .eq("id", purchase.id)
    .eq("payment_status", "pending"); // race guard: only transition once
  if (updErr) {
    console.error("mark paid failed:", updErr);
    return { minted: 0, alreadyPaid: false, skipped: "update_failed" };
  }

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

  try { await sendEmail(purchase.id, purchase.buyer_email, batch!.batch_name, codes, validUntil); }
  catch (err) { console.error("resend send (non-fatal):", err); }

  return { minted: codes.length, alreadyPaid: false };
}

// Look up a PayMongo checkout session and return whether it's been paid.
// Uses PAYMONGO_SECRET_KEY. Returns { paid: boolean, error? }.
export async function checkPaymongoSessionPaid(
  sessionId: string,
): Promise<{ paid: boolean; error?: string }> {
  const key = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!key) return { paid: false, error: "paymongo_key_missing" };
  try {
    const res = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      method: "GET",
      headers: { Authorization: `Basic ${btoa(`${key}:`)}`, Accept: "application/json" },
    });
    if (!res.ok) return { paid: false, error: `paymongo_${res.status}` };
    const json = await res.json() as {
      data?: { attributes?: {
        payment_intent?: { attributes?: { status?: string } };
        payments?: Array<{ attributes?: { status?: string } }>;
      } };
    };
    const attrs = json.data?.attributes;
    const anyPaid = (attrs?.payments ?? []).some(
      (p) => p.attributes?.status === "paid" || p.attributes?.status === "succeeded",
    );
    const intentSucceeded = attrs?.payment_intent?.attributes?.status === "succeeded";
    return { paid: anyPaid || intentSucceeded };
  } catch (err) {
    return { paid: false, error: (err as Error).message };
  }
}
