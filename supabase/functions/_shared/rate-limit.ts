import { createClient } from "npm:@supabase/supabase-js@2";

// In-memory fallback used when the DB call fails (e.g. cold-start, transient error).
const _buckets = new Map<string, { count: number; resetAt: number }>();
function _inMemory(id: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = _buckets.get(id);
  if (!b || b.resetAt < now) {
    _buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  if (b.count >= max) return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
  b.count++;
  return { ok: true, remaining: max - b.count };
}

/**
 * DB-backed distributed rate limit using the `rate_limits` table.
 * The window start is floored to the nearest `windowMs` boundary so all
 * instances share the same bucket. Falls back to in-memory on DB error.
 */
export async function rateLimit(
  id: string,
  max = 30,
  windowMs = 60_000,
): Promise<{ ok: boolean; remaining: number; retryAfterMs?: number }> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await client.rpc("check_rate_limit", {
      p_identifier: id,
      p_window_start: windowStart,
      p_max_count: max,
    });

    if (error || !data?.length) throw error ?? new Error("no data");

    const { allowed, current_count } = data[0] as { allowed: boolean; current_count: number };
    return {
      ok: allowed,
      remaining: Math.max(0, max - current_count),
      ...(allowed ? {} : { retryAfterMs: windowMs - (Date.now() % windowMs) }),
    };
  } catch {
    return _inMemory(id, max, windowMs);
  }
}
