import { z } from "npm:zod@3.23.8";

export const ENABLE_UNAPPROVED_PROVIDERS = Deno.env.get("ENABLE_UNAPPROVED_PROVIDERS") === "true";

export const PaymentProviderSchema = z.enum(["paymongo", "stripe"]);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const SupportedMethodSchema = z.enum(["card", "gcash", "maya", "wallet"]);
export type SupportedMethod = z.infer<typeof SupportedMethodSchema>;

const BLOCKED_METHODS = new Set([
  "prepaid",
  "gift",
  "anonymous_reloadable",
  "interac_debit_only",
  "non_hold_method",
]);

export type PaymentState =
  | "intent_created"
  | "authorized"
  | "captured"
  | "refunding"
  | "refunded"
  | "payout_on_hold"
  | "payout_released"
  | "failed";

export type RefundWindow = {
  refundable_until: string;
  payout_release_on: string;
};

export function isProviderAllowed(provider: string): provider is PaymentProvider {
  if (provider === "paymongo" || provider === "stripe") return true;
  return ENABLE_UNAPPROVED_PROVIDERS;
}

export function validatePaymentMethod(method: string, requiresHold: boolean): { ok: boolean; reason?: string } {
  if (BLOCKED_METHODS.has(method)) return { ok: false, reason: `Unsupported payment method: ${method}` };
  if (requiresHold && method === "wallet") {
    return { ok: false, reason: "Wallet payments cannot secure incidentals for hold-required bookings" };
  }
  return { ok: true };
}

export function buildRefundWindow(checkInISO: string): RefundWindow {
  const checkIn = new Date(checkInISO);
  const refundableUntil = new Date(checkIn);
  refundableUntil.setUTCDate(refundableUntil.getUTCDate() - 2);

  const payoutRelease = new Date(checkIn);
  payoutRelease.setUTCDate(payoutRelease.getUTCDate() + 1);

  return {
    refundable_until: refundableUntil.toISOString(),
    payout_release_on: payoutRelease.toISOString(),
  };
}

export interface PaymentProviderAdapter {
  createIntent(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  authorize(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  capture(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  refund(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  payout(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  verifyWebhook(rawBody: string, signatureHeader: string): Promise<boolean>;
}
