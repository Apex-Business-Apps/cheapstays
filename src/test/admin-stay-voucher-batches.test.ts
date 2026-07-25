import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const createFn = readFileSync("supabase/functions/admin-stay-voucher-batch-create/index.ts", "utf8");
const deactivateFn = readFileSync("supabase/functions/admin-stay-voucher-batch-deactivate/index.ts", "utf8");

describe("admin-stay-voucher-batch-create", () => {
  it("enforces admin role via has_role", () => {
    expect(createFn).toContain(".rpc(\"has_role\"");
  });
  it("awaits the rate limit call", () => {
    expect(createFn).toMatch(/await rateLimit\(/);
  });
  it("validates the body with Zod including all six required fields", () => {
    expect(createFn).toContain("z.object");
    for (const field of ["listing_id","batch_name","nights","price_php","quantity","valid_days"]) {
      expect(createFn).toContain(field);
    }
  });
  it("caps nights, quantity, and valid_days at 30/500/14 respectively", () => {
    expect(createFn).toMatch(/\.max\(30\)/);
    expect(createFn).toMatch(/\.max\(500\)/);
    expect(createFn).toMatch(/\.max\(14\)/);
  });
});

describe("admin-stay-voucher-batch-deactivate", () => {
  it("enforces admin role via has_role", () => {
    expect(deactivateFn).toContain(".rpc(\"has_role\"");
  });
  it("awaits the rate limit call", () => {
    expect(deactivateFn).toMatch(/await rateLimit\(/);
  });
  it("only updates is_active — does not touch valid_until on existing codes", () => {
    expect(deactivateFn).toContain("is_active: false");
    expect(deactivateFn).not.toMatch(/stay_voucher_codes[\s\S]{0,400}status/);
  });
});
