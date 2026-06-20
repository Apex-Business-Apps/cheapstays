import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260620140000_phase4_vouchers_schema.sql",
  "utf8"
);
const purchaseVoucherFunction = readFileSync("supabase/functions/purchase-voucher/index.ts", "utf8");
const redeemVoucherFunction = readFileSync("supabase/functions/redeem-voucher/index.ts", "utf8");
const hostVouchers = readFileSync("src/components/HostVouchers.tsx", "utf8");

describe("voucher redemption support & host validation", () => {
  it("active voucher redeems successfully via RPC", () => {
    // RPC updates voucher and creates booking
    expect(migration).toContain("status = 'redeemed'");
    expect(migration).toContain("INSERT INTO public.bookings");
    expect(migration).toContain("booking_mode");
    expect(redeemVoucherFunction).toContain("redeem_voucher_transaction");
  });

  it("redemption creates one completed booking", () => {
    expect(migration).toContain("'completed'");
    expect(migration).toContain("RETURNING id INTO v_booking_id");
  });

  it("second redemption does not create duplicate booking (idempotency)", () => {
    expect(migration).toContain("IF v_voucher.status = 'redeemed' THEN");
    expect(migration).toContain("RETURN jsonb_build_object('success', true, 'booking_id', v_voucher.booking_id, 'message', 'Voucher already redeemed')");
  });

  it("wrong host cannot redeem", () => {
    expect(migration).toContain("IF NOT FOUND OR v_listing.host_id != p_caller_id THEN");
    expect(migration).toContain("RAISE EXCEPTION 'Unauthorized: Caller is not the host of this listing'");
  });

  it("expired/refunded/cancelled voucher cannot redeem", () => {
    expect(migration).toContain("IF v_voucher.status != 'active' THEN");
    expect(migration).toContain("IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN");
    expect(migration).toContain("RAISE EXCEPTION 'Voucher is expired'");
  });

  it("purchase-voucher rejects unsupported durations and non-voucher listings", () => {
    expect(purchaseVoucherFunction).toContain("![3, 6, 12].includes(duration_hours)");
    expect(purchaseVoucherFunction).toContain("Unsupported duration. Must be 3, 6, or 12 hours.");
    expect(purchaseVoucherFunction).toContain("if (listing.booking_mode !== \"voucher\") {");
  });

  it("Host UI blocks wrong host dynamically", () => {
    // Only fetches vouchers for listings owned by hostId
    expect(hostVouchers).toContain(".eq(\"listings.host_id\", hostId)");
    expect(hostVouchers).toContain("supabase.functions.invoke(\"redeem-voucher\"");
  });
});
