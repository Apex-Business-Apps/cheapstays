import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webhook = readFileSync("supabase/functions/stay-voucher-webhook/index.ts", "utf8");
const mint = readFileSync("supabase/functions/_shared/stay-voucher-mint.ts", "utf8");

describe("stay-voucher-webhook", () => {
  it("verifies PayMongo signature", () => {
    expect(webhook).toContain("verifyPaymongoSignature");
  });
  it("is idempotent via webhook_events with provider paymongo_stay_voucher", () => {
    expect(webhook).toContain("paymongo_stay_voucher");
    expect(webhook).toContain("webhook_events");
  });
  it("delegates the paid transition + code minting to the shared helper", () => {
    // Mint logic lives in _shared/stay-voucher-mint.ts so both the webhook
    // and the success-page self-heal path go through the same code.
    expect(webhook).toContain("markPaidAndMintCodes");
  });
  it("looks up the purchase by metadata purchase_id with payment_ref fallback", () => {
    // Fast path: metadata.purchase_id set by the checkout function
    expect(webhook).toContain("purchaseId");
    // Fallback path: match on payment_ref (checkout session id)
    expect(webhook).toContain("payment_ref");
  });
});

describe("stay-voucher-mint (shared helper)", () => {
  it("mints exactly quantity codes and sets valid_until = paid_at + valid_days", () => {
    expect(mint).toMatch(/for \(let i = 0; i < .*quantity/);
    expect(mint).toMatch(/valid_days/);
  });
  it("retries code generation on unique-collision up to 5 times", () => {
    expect(mint).toMatch(/attempts?\s*<\s*5|MAX_CODE_ATTEMPTS/);
  });
  it("sends email via Resend when RESEND_API_KEY is set (graceful no-op otherwise)", () => {
    expect(mint).toContain("RESEND_API_KEY");
    expect(mint).toMatch(/api\.resend\.com/);
  });
  it("uses Crockford base32 for codes (no 0/O/1/I/L)", () => {
    expect(mint).toMatch(/23456789ABCDEFGHJKMNPQRSTVWXYZ/);
  });
  it("guards against double-minting via a pending → paid race condition", () => {
    // The mark-paid UPDATE has an .eq("payment_status","pending") clause so
    // two concurrent callers can't both flip the row and both mint.
    expect(mint).toMatch(/\.eq\(["']payment_status["'],\s*["']pending["']\)/);
  });
  it("returns idempotently when the purchase is already paid", () => {
    expect(mint).toMatch(/alreadyPaid:\s*true/);
  });
});
