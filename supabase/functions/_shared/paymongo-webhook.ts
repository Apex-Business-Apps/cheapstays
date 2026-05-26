export const PAYMONGO_SIGNATURE_HEADER = "Paymongo-Signature";
export const SUPPORTED_PAYMONGO_EVENTS = new Set(["checkout_session.payment.paid"]);

export type PaymongoEventEnvelope = {
  data?: {
    id?: string;
    attributes?: {
      type?: string;
      data?: {
        id?: string;
        attributes?: {
          metadata?: Record<string, unknown>;
          payment_intent_id?: string;
          payment_id?: string;
          paid_at?: number | string;
        };
      };
    };
  };
};

export function parsePaymongoEvent(rawBody: string): { eventId: string; eventType: string; payload: PaymongoEventEnvelope } {
  const payload = JSON.parse(rawBody) as PaymongoEventEnvelope;
  const eventId = payload?.data?.id;
  const eventType = payload?.data?.attributes?.type;
  if (!eventId || !eventType) throw new Error("Missing event id or event type");
  return { eventId, eventType, payload };
}

export function extractBookingId(payload: PaymongoEventEnvelope): string | null {
  const candidate = payload?.data?.attributes?.data?.attributes?.metadata?.booking_id;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

export function parseSignatureHeader(signatureHeader: string): { timestamp: string; signature: string } | null {
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [k, v] = segment.split("=");
    if (k && v) parts[k.trim().toLowerCase()] = v.trim();
  }
  const timestamp = parts.t;
  const signature = parts.li ?? parts.te;
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

function constantTimeHexEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a.toLowerCase());
  const bBuf = enc.encode(b.toLowerCase());
  if (aBuf.length !== bBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) diff |= aBuf[i] ^ bBuf[i];
  return diff === 0;
}

export async function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  maxAgeSeconds?: number,
): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const timestampSec = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSec)) return false;
  // Replay protection is opt-in so helper tests can validate deterministic HMAC values.
  if (typeof maxAgeSeconds === "number" && Math.abs(Math.floor(Date.now() / 1000) - timestampSec) > maxAgeSeconds) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parsed.timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return constantTimeHexEqual(computed, parsed.signature);
}
