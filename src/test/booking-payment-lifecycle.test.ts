import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260529120000_restore_booking_payment_lifecycle.sql",
  "utf8",
);
const checkoutFunction = readFileSync("supabase/functions/booking-checkout/index.ts", "utf8");
const bookingPanel = readFileSync("src/components/BookingPanel.tsx", "utf8");
const myBookings = readFileSync("src/pages/MyBookings.tsx", "utf8");

describe("booking payment lifecycle regression", () => {
  it("defines the paid_at column before the PayMongo paid webhook writes it", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ");
    expect(migration).toContain("paid_at = COALESCE(paid_at, now())");
  });

  it("activates canonical booking flow state when PayMongo reports a paid checkout", () => {
    expect(migration).toContain("flow_state IN ('payment_pending', 'approved', 'auto_approved')");
    expect(migration).toContain("THEN 'active'");
    expect(migration).toContain("'paymongo_checkout_session_paid'");
  });

  it("never writes non-existent payment_status enum values while expiring stale holds", () => {
    expect(migration).not.toContain("payment_status='expired'");
    expect(migration).toContain("ELSE 'failed'::public.payment_status");
    expect(migration).toContain("expire-pending-booking-payments");
  });

  it("persists checkout session IDs and surfaces database persistence failures", () => {
    expect(checkoutFunction).toContain('"Idempotency-Key": idempotencyKey');
    expect(checkoutFunction).toContain("payment_ref: checkoutSession.id");
    expect(checkoutFunction).toContain("Failed to persist checkout session");
  });

  it("does not silently mark bookings done when checkout returns an error payload", () => {
    expect(bookingPanel).toContain("if (data?.error) throw new Error(data.error)");
    expect(bookingPanel).toContain('throw new Error("Payment provider did not return a checkout URL")');
  });

  it("lets guests resume pending hosted checkout payments", () => {
    expect(myBookings).toContain('["unpaid", "pending", "failed"].includes(b.payment_status)');
    expect(myBookings).toContain('b.payment_status === "pending" ? "Resume payment" : "Pay now"');
  });
});
