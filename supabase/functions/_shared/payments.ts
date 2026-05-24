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

// ── Tier-aware refund calculator ──────────────────────────────────────────────
//
// Tiers (measured in hours from now to check-in midnight UTC):
//   "full"        ≥ 168 h (7 days)  — full accommodation refund, no penalty
//   "partial_10"  ≥  48 h < 168 h   — 10% accommodation penalty
//   "partial_30"  <  48 h            — 30% accommodation penalty
//   "zero"        check_out passed   — no refund (billing artefact only)
//
// Platform always retains the 5% service fee regardless of tier.
// Host payout of retained penalty: 70% host / 30% platform.

export type RefundTier = "full" | "partial_10" | "partial_30" | "zero";

export interface RefundBreakdown {
  tier: RefundTier;
  accommodation_php: number;
  service_fee_php: number;
  penalty_php: number;
  refunded_php: number;
  host_share_php: number;
  platform_share_php: number;
}

const SERVICE_FEE_RATE = 0.05;
const HOST_PENALTY_SHARE = 0.70;
const PLATFORM_PENALTY_SHARE = 0.30;

export function calculateRefundTier(checkInISO: string, now: Date = new Date()): RefundTier {
  const checkIn = new Date(checkInISO + "T00:00:00Z");
  const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntilCheckIn < 0) return "zero";
  if (hoursUntilCheckIn < 48) return "partial_30";
  if (hoursUntilCheckIn < 168) return "partial_10";
  return "full";
}

export function calculateRefundAmounts(
  checkInISO: string,
  totalPhp: number,
  tierOverride?: RefundTier,
  now: Date = new Date(),
): RefundBreakdown {
  const tier = tierOverride ?? calculateRefundTier(checkInISO, now);
  const service_fee_php = Math.round(totalPhp * SERVICE_FEE_RATE / (1 + SERVICE_FEE_RATE));
  const accommodation_php = totalPhp - service_fee_php;

  let penalty_php = 0;
  if (tier === "partial_10") penalty_php = Math.round(accommodation_php * 0.10);
  else if (tier === "partial_30") penalty_php = Math.round(accommodation_php * 0.30);
  else if (tier === "zero") penalty_php = accommodation_php;

  const refunded_php = totalPhp - service_fee_php - penalty_php;
  const host_share_php = Math.round(penalty_php * HOST_PENALTY_SHARE);
  const platform_share_php = penalty_php - host_share_php;

  return {
    tier,
    accommodation_php,
    service_fee_php,
    penalty_php,
    refunded_php: Math.max(0, refunded_php),
    host_share_php,
    platform_share_php,
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
