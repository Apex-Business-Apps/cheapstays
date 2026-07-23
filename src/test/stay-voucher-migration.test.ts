import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260723000000_stay_vouchers.sql",
  "utf8",
);

describe("stay-voucher migration", () => {
  it("creates all four tables", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.stay_voucher_batches/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.stay_voucher_purchases/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.stay_voucher_codes/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.platform_revenue_events/);
  });

  it("caps valid_days at 14", () => {
    expect(migration).toMatch(/valid_days.*CHECK \(valid_days BETWEEN 1 AND 14\)/);
  });

  it("caps batch quantity at 500 and per-purchase quantity at 10", () => {
    expect(migration).toMatch(/quantity.*CHECK \(quantity BETWEEN 1 AND 500\)/);
    expect(migration).toMatch(/quantity.*CHECK \(quantity BETWEEN 1 AND 10\)/);
  });

  it("uses has_role for all admin/host policies (no JWT-claim fallback)", () => {
    expect(migration).not.toMatch(/auth\.jwt\(\)\s*->>?\s*'role'/);
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\), 'admin'\)/);
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\), 'host'\)/);
  });

  it("defines the atomic redemption RPC and locks the row", () => {
    expect(migration).toMatch(/redeem_stay_voucher_transaction/);
    expect(migration).toMatch(/FOR UPDATE/);
  });

  it("adds guest_name_snapshot to bookings", () => {
    expect(migration).toMatch(/ALTER TABLE public\.bookings[\s\S]*ADD COLUMN IF NOT EXISTS guest_name_snapshot TEXT/);
  });

  it("drops the NOT NULL on bookings.guest_id for anonymous voucher redemption", () => {
    expect(migration).toMatch(/ALTER TABLE public\.bookings[\s\S]*ALTER COLUMN guest_id DROP NOT NULL/);
  });

  it("schedules the 6-hour expiry cron guarded by pg_extension check", () => {
    expect(migration).toMatch(/cheapstays-stay-voucher-expiry/);
    expect(migration).toMatch(/pg_extension WHERE extname = 'pg_cron'/);
  });
});
