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
  it("counts codes against batch.quantity for stock (sold + quantity > quantity)", () => {
    expect(fn).toMatch(/sold[\s\S]{0,80}quantity[\s\S]{0,80}batch\.quantity/);
  });
  it("mints a cryptographic success_token before writing to the purchase row", () => {
    expect(fn).toMatch(/crypto\.getRandomValues|randomUUID/);
    expect(fn).toContain("success_token");
    // Token must be minted before the INSERT into stay_voucher_purchases,
    // not just any mention of the table (the stock-check reads the table
    // earlier in the flow — that read is not what this rule protects).
    const tokenIdx = fn.search(/const\s+success_token\s*=/);
    const insertIdx = fn.search(/\.from\(["']stay_voucher_purchases["']\)\s*\.insert/);
    expect(tokenIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(tokenIdx);
  });
  it("stores the PayMongo checkout session id on the purchase row", () => {
    expect(fn).toContain("payment_ref");
  });
  it("builds a PayMongo checkout session with metadata { purchase_id }", () => {
    expect(fn).toContain("checkout_sessions");
    expect(fn).toMatch(/metadata:\s*\{[^}]*purchase_id/);
  });
});
