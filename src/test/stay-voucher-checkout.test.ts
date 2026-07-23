import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/stay-voucher-checkout/index.ts", "utf8");

describe("stay-voucher-checkout", () => {
  it("is anonymous (no getUserFromRequest call required)", () => {
    // Anonymous purchase — must not require auth
    expect(fn).not.toMatch(/getUserFromRequest/);
  });
  it("awaits the rate limit call", () => {
    expect(fn).toMatch(/await rateLimit\(/);
  });
  it("rejects the request when accept_terms is not true", () => {
    expect(fn).toMatch(/accept_terms/);
    expect(fn).toMatch(/z\.literal\(true\)/);
  });
  it("counts unclaimed codes against batch.quantity for stock", () => {
    expect(fn).toContain("stay_voucher_codes");
    expect(fn).toContain("unclaimed");
  });
  it("mints a cryptographic success_token before creating the PayMongo session", () => {
    expect(fn).toMatch(/crypto\.getRandomValues|randomUUID/);
    expect(fn).toContain("success_token");
    // token minted before insert
    const tokenIdx = fn.indexOf("success_token");
    const insertIdx = fn.indexOf("stay_voucher_purchases");
    expect(tokenIdx).toBeLessThan(insertIdx);
  });
  it("stores the PayMongo checkout session id on the purchase row", () => {
    expect(fn).toContain("payment_ref");
  });
  it("builds a PayMongo checkout session with metadata { purchase_id }", () => {
    expect(fn).toContain("checkout_sessions");
    expect(fn).toMatch(/metadata:\s*\{[^}]*purchase_id/);
  });
});
