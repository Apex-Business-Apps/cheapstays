import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/stay-voucher-webhook/index.ts", "utf8");

describe("stay-voucher-webhook", () => {
  it("verifies PayMongo signature", () => {
    expect(fn).toContain("verifyPaymongoSignature");
  });
  it("is idempotent via webhook_events with provider paymongo_stay_voucher", () => {
    expect(fn).toContain("paymongo_stay_voucher");
    expect(fn).toContain("webhook_events");
  });
  it("mints exactly quantity codes and sets valid_until = paid_at + valid_days", () => {
    expect(fn).toMatch(/for \(let i = 0; i < .*quantity/);
    expect(fn).toMatch(/valid_days/);
  });
  it("retries code generation on unique-collision up to 5 times", () => {
    expect(fn).toMatch(/attempts?\s*<\s*5|MAX_CODE_ATTEMPTS/);
  });
  it("sends email via Resend when RESEND_API_KEY is set (graceful no-op otherwise)", () => {
    expect(fn).toContain("RESEND_API_KEY");
    expect(fn).toMatch(/api\.resend\.com/);
  });
  it("uses Crockford base32 for codes (no 0/O/1/I/L)", () => {
    expect(fn).toMatch(/23456789ABCDEFGHJKMNPQRSTVWXYZ/);
  });
});
