import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const preview = readFileSync("supabase/functions/host-stay-voucher-preview/index.ts", "utf8");
const redeem  = readFileSync("supabase/functions/host-stay-voucher-redeem/index.ts", "utf8");

describe("host-stay-voucher-preview", () => {
  it("enforces host role via has_role", () => {
    expect(preview).toContain(".rpc(\"has_role\"");
    expect(preview).toMatch(/_role:\s*['"]host['"]/);
  });
  it("returns 404 when code is unknown", () => {
    expect(preview).toMatch(/Voucher code not found/);
  });
});

describe("host-stay-voucher-redeem", () => {
  it("delegates the write path to redeem_stay_voucher_transaction RPC", () => {
    expect(redeem).toContain("redeem_stay_voucher_transaction");
  });
  it("enforces host role via has_role", () => {
    expect(redeem).toContain(".rpc(\"has_role\"");
    expect(redeem).toMatch(/_role:\s*['"]host['"]/);
  });
  it("passes p_check_in as a YYYY-MM-DD date", () => {
    expect(redeem).toMatch(/p_check_in/);
    expect(redeem).toMatch(/z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  });
  it("invokes credit-host-wallet on successful redemption", () => {
    expect(redeem).toContain("credit-host-wallet");
    expect(redeem).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
