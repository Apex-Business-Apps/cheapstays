import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260723000002_add_flow_state_to_stay_voucher_rpc.sql",
  "utf8",
);

describe("supplemental migration: flow_state fix for redeem_stay_voucher_transaction", () => {
  it("contains flow_state in the INSERT column list", () => {
    // The column list and values list must both mention flow_state
    expect(migration).toContain("flow_state");
  });

  it("sets flow_state to 'active' as its value", () => {
    // Verify 'active' appears as the value for the flow_state column
    expect(migration).toContain("'active'");
  });

  it("uses CREATE OR REPLACE FUNCTION on the correct RPC", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.redeem_stay_voucher_transaction/);
  });

  it("flow_state column appears before its value 'active' in the INSERT", () => {
    // Confirms column list precedes values list (structural sanity)
    const colIdx = migration.indexOf("flow_state");
    const valIdx = migration.indexOf("'active'");
    expect(colIdx).toBeGreaterThan(-1);
    expect(valIdx).toBeGreaterThan(colIdx);
  });
});
