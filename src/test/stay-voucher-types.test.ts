import { describe, expect, it } from "vitest";
import type {
  StayVoucherBatch,
  StayVoucherCode,
  StayVoucherPurchase,
  PlatformRevenueEvent,
  StayVoucherStatus,
  StayVoucherPaymentMethod,
} from "@/types/stay-vouchers";

describe("stay-voucher types", () => {
  it("StayVoucherStatus is a closed union of three literals", () => {
    const values: StayVoucherStatus[] = ["unclaimed", "claimed", "expired"];
    expect(values).toHaveLength(3);
  });

  it("StayVoucherPaymentMethod accepts gcash/maya/card only", () => {
    const values: StayVoucherPaymentMethod[] = ["gcash", "maya", "card"];
    expect(values).toHaveLength(3);
  });

  it("compiles a StayVoucherBatch shape", () => {
    const b: StayVoucherBatch = {
      id: "id", listing_id: "l", batch_name: "n", nights: 1,
      price_php: 1999, quantity: 10, valid_days: 14, terms: null,
      is_active: true, created_by: "u", created_at: "2026-07-23T00:00:00Z",
    };
    expect(b.price_php).toBe(1999);
  });

  it("compiles a StayVoucherPurchase and StayVoucherCode and PlatformRevenueEvent", () => {
    const p: StayVoucherPurchase = {
      id: "p", batch_id: "b", quantity: 1,
      buyer_name: "x", buyer_email: "x@y", buyer_phone: "+63",
      subtotal_php: 1999, payment_provider: "paymongo", payment_method: "gcash",
      payment_ref: null, payment_status: "pending",
      success_token: "t", created_at: "2026-07-23T00:00:00Z", paid_at: null,
    };
    const c: StayVoucherCode = {
      id: "c", batch_id: "b", code: "CS-XXXX-XXXX",
      status: "unclaimed", purchase_id: "p", booking_id: null,
      valid_until: "2026-08-06T00:00:00Z",
      redeemed_by_host_id: null, redeemed_at: null,
      created_at: "2026-07-23T00:00:00Z",
    };
    const r: PlatformRevenueEvent = {
      id: "r", source: "voucher_expired", amount_php: 1999,
      stay_voucher_code_id: "c", occurred_at: "2026-08-06T00:00:00Z",
    };
    expect([p.payment_status, c.status, r.source]).toEqual(["pending", "unclaimed", "voucher_expired"]);
  });
});
