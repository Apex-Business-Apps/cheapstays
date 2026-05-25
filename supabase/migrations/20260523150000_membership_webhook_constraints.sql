-- Add a partial unique index on membership_subscriptions(paymongo_session_id)
-- so webhook lookups by session id are efficient and enforce uniqueness
-- where a session id is present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_session_id
  ON public.membership_subscriptions(paymongo_session_id)
  WHERE paymongo_session_id IS NOT NULL;
