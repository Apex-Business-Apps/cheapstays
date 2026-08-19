import { describe, expect, it } from "vitest";
import { PLATFORM_FEE_RATE, formatPHP, splitEarnings } from "@/lib/money";

describe("money helpers", () => {
  it("splits gross into 10% platform fee + 90% host earnings", () => {
    expect(splitEarnings(1000)).toEqual({ fee: 100, host: 900 });
    expect(splitEarnings(2499)).toEqual({ fee: 249.9, host: 2249.1 });
  });

  it("rounds to two decimals to avoid float drift", () => {
    const { fee, host } = splitEarnings(3333.33);
    expect(fee + host).toBeCloseTo(3333.33, 2);
  });

  it("uses the same 10% rate the wallet-credit-reconcile edge function uses", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.1);
  });

  it("formats PHP with peso sign and no decimals", () => {
    const out = formatPHP(12345);
    expect(out).toMatch(/₱\s*12,345/);
  });

  it("treats null/undefined amounts as zero", () => {
    expect(formatPHP(null)).toMatch(/₱\s*0/);
    expect(formatPHP(undefined)).toMatch(/₱\s*0/);
  });
});
