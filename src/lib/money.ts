export const PLATFORM_FEE_RATE = 0.10;

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const phpCompact = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatPHP(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return phpFormatter.format(Number.isFinite(n) ? n : 0);
}

export function formatPHPCompact(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return phpCompact.format(Number.isFinite(n) ? n : 0);
}

export function splitEarnings(gross: number): { fee: number; host: number } {
  const fee = Math.round(gross * PLATFORM_FEE_RATE * 100) / 100;
  return { fee, host: Math.round((gross - fee) * 100) / 100 };
}
