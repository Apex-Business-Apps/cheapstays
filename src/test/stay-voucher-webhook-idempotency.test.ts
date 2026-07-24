import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("webhook_events provider CHECK", () => {
  const migration = readFileSync(
    "supabase/migrations/20260723000001_expand_webhook_events_provider.sql",
    "utf8",
  );

  it("adds paymongo_stay_voucher to the allowed provider set", () => {
    expect(migration).toMatch(/CHECK \(provider IN \('stripe', 'paymongo', 'paymongo_stay_voucher'\)\)/);
  });

  it("drops the prior constraint before recreating (idempotent)", () => {
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS webhook_events_provider_check/);
  });
});
