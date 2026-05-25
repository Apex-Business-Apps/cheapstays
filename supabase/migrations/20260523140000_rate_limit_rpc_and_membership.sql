-- ============================================================
-- 1. Harden rate_limits table (RLS was missing)
-- ============================================================
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits"
  ON public.rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. Atomic DB-backed rate-limit check used by edge functions.
--    Uses INSERT ... ON CONFLICT to atomically increment the
--    counter, avoiding the race condition an application-side
--    SELECT + UPDATE would have.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier  TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_count   INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (identifier, window_start, count)
  VALUES (p_identifier, p_window_start, 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING rate_limits.count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_max_count), v_count;
END;
$$;

-- ============================================================
-- 3. Membership subscriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.membership_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','cancelled','expired','past_due')),
  plan                TEXT NOT NULL DEFAULT 'member_monthly',
  paymongo_session_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscriptions"
  ON public.membership_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON public.membership_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_membership_user_id
  ON public.membership_subscriptions (user_id, status);

CREATE TRIGGER update_membership_subscriptions_updated_at
  BEFORE UPDATE ON public.membership_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
