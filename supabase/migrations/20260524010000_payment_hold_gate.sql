-- ============================================================
-- Payment Hold Gate
-- Adds infrastructure for card pre-authorization (manual capture):
--   1. 'capturing' enum value — prevents double-capture race
--   2. card_holds table — tracks hold metadata and expiry
--   3. pg_cron jobs — daily capture + reauth-check notifications
--
-- Requires extensions: pg_cron, pg_net
-- Requires GUC settings (set post-deploy, not in migration):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<key>';
-- ============================================================

-- 1. Extend payment_state enum with 'capturing' (between authorized and captured)
ALTER TYPE payment_state ADD VALUE IF NOT EXISTS 'capturing' AFTER 'authorized';

-- 2. card_holds — one row per active card hold, keyed by booking
CREATE TABLE IF NOT EXISTS public.card_holds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL UNIQUE REFERENCES public.bookings(id),
  payment_intent_id TEXT NOT NULL,
  provider          TEXT NOT NULL DEFAULT 'paymongo',
  authorized_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  captured_at       TIMESTAMPTZ,
  reauth_sent_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_holds_expires_at_idx
  ON public.card_holds (expires_at)
  WHERE captured_at IS NULL;

ALTER TABLE public.card_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests can view their card holds"
  ON public.card_holds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = card_holds.booking_id
        AND bookings.guest_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages card holds"
  ON public.card_holds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. pg_cron jobs (idempotent: delete-then-create)
DO $$
BEGIN
  -- Remove stale schedules if re-running migration
  DELETE FROM cron.job
  WHERE jobname IN ('capture-card-holds-daily', 'reauth-check-card-holds');
EXCEPTION WHEN undefined_table THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

DO $$
BEGIN
  -- 00:05 UTC: capture all card holds whose check-in date is today
  PERFORM cron.schedule(
    'capture-card-holds-daily',
    '5 0 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/capture-booking-payment',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := '{"mode":"capture"}'::jsonb
      )
      $sql$,
      current_setting('app.supabase_url', true)
    )
  );

  -- 06:00 UTC: notify guests whose card hold expires within 24 hours
  PERFORM cron.schedule(
    'reauth-check-card-holds',
    '0 6 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/capture-booking-payment',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := '{"mode":"reauth_check"}'::jsonb
      )
      $sql$,
      current_setting('app.supabase_url', true)
    )
  );
EXCEPTION WHEN undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;
