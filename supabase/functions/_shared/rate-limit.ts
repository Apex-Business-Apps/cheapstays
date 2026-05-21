// Simple in-memory rate limit placeholder per identifier.
// Replace with Upstash/Redis or a Supabase table for production.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(id: string, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  if (b.count >= max) return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
  b.count++;
  return { ok: true, remaining: max - b.count };
}
