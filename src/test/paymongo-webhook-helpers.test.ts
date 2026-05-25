import { describe, expect, it } from "vitest";
import {
  extractBookingId,
  parsePaymongoEvent,
  parseSignatureHeader,
  verifyPaymongoSignature,
} from "../../supabase/functions/_shared/paymongo-webhook";

const paidEventPayload = {
  data: {
    id: "evt_123",
    attributes: {
      type: "checkout_session.payment.paid",
      data: {
        id: "cs_123",
        attributes: {
          payment_intent_id: "pi_123",
          metadata: { booking_id: "2b87bb35-08ef-4656-ab3f-9ac5350346f3" },
        },
      },
    },
  },
};

describe("paymongo webhook helpers", () => {
  it("extracts booking_id from paid checkout payload", () => {
    expect(extractBookingId(paidEventPayload)).toBe("2b87bb35-08ef-4656-ab3f-9ac5350346f3");
  });

  it("parses event id and event type", () => {
    const parsed = parsePaymongoEvent(JSON.stringify(paidEventPayload));
    expect(parsed.eventId).toBe("evt_123");
    expect(parsed.eventType).toBe("checkout_session.payment.paid");
  });

  it("returns null when booking_id metadata is missing", () => {
    expect(extractBookingId({ data: { attributes: { data: { attributes: { metadata: {} } } } } })).toBeNull();
  });

  it("rejects invalid signature", async () => {
    const ok = await verifyPaymongoSignature(JSON.stringify(paidEventPayload), "t=1717090000,li=deadbeef", "whsec_test");
    expect(ok).toBe(false);
  });

  it("validates computed signature", async () => {
    const raw = JSON.stringify(paidEventPayload);
    const ts = "1717090000";
    const secret = "whsec_test";

    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${raw}`));
    const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const ok = await verifyPaymongoSignature(raw, `t=${ts},li=${hex}`, secret);
    expect(ok).toBe(true);
  });

  it("parses paymongo-signature header", () => {
    expect(parseSignatureHeader("t=1717090000,te=abc")).toEqual({ timestamp: "1717090000", signature: "abc" });
  });
});
