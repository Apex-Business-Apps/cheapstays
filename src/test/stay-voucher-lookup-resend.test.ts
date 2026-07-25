import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lookup = readFileSync("supabase/functions/stay-voucher-purchase-lookup/index.ts", "utf8");
const resend = readFileSync("supabase/functions/stay-voucher-resend-email/index.ts", "utf8");

describe("stay-voucher-purchase-lookup", () => {
  it("requires success_token match", () => {
    expect(lookup).toContain("success_token");
    expect(lookup).toMatch(/\.eq\("success_token"/);
  });
  it("does not return the code array unless payment_status === 'paid'", () => {
    // Codes are gated behind the paid check
    expect(lookup).toMatch(/payment_status\s*[!=]==?\s*['"]paid['"]/);
  });
  it("awaits the rate limit", () => {
    expect(lookup).toMatch(/await rateLimit\(/);
  });
});

describe("stay-voucher-resend-email", () => {
  it("verifies success_token before sending", () => {
    expect(resend).toContain("success_token");
    expect(resend).toMatch(/\.eq\("success_token"/);
  });
  it("caps at 5 requests per minute per purchase", () => {
    expect(resend).toMatch(/rateLimit\([^)]*purchase[^)]*,\s*5,\s*60_000\)/);
  });
});
