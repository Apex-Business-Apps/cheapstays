-- Booking lifecycle scheduler jobs via pg_cron + pg_net.
--
-- Jobs registered here:
--   expire-pending-long-term-requests  — every 10 min: requested → expired when deadline passed
--   auto-approve-long-term-requests    — every hour: requested → auto_approved (flag-gated)
--   complete-bookings-past-checkout    — every 30 min: active → completed when check_out passed
--
-- Feature status:
--   Stays over 30 days are restricted to upfront payments; monthly recurring billing is disabled.
--
-- Requires extensions: pg_cron, pg_net (both present per §1 of CLAUDE.md).
-- Migration is idempotent: stale jobs are deleted before re-creation.

-- Remove stale schedules if re-running migration
DO $$
BEGIN
  DELETE FROM cron.job
  WHERE jobname IN (
    'expire-pending-long-term-requests',
    'auto-approve-long-term-requests',
    'complete-bookings-past-checkout'
  );
EXCEPTION WHEN undefined_table THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

-- Schedule: expire-pending-long-term-requests (every 10 minutes)
DO $$
BEGIN
  PERFORM cron.schedule(
    'expire-pending-long-term-requests',
    '*/10 * * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/expire-pending-long-term-requests',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := '{}'::jsonb
      )
      $sql$,
      current_setting('app.supabase_url', true)
    )
  );
EXCEPTION WHEN undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

-- Schedule: auto-approve-long-term-requests (every hour at :30)
-- No-op when LONG_TERM_AUTO_APPROVAL_ENABLED env var is not "true".
DO $$
BEGIN
  PERFORM cron.schedule(
    'auto-approve-long-term-requests',
    '30 * * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/auto-approve-long-term-requests',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := '{}'::jsonb
      )
      $sql$,
      current_setting('app.supabase_url', true)
    )
  );
EXCEPTION WHEN undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

-- Schedule: complete-bookings-past-checkout (every 30 minutes)
DO $$
BEGIN
  PERFORM cron.schedule(
    'complete-bookings-past-checkout',
    '*/30 * * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/complete-bookings-past-checkout',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := '{}'::jsonb
      )
      $sql$,
      current_setting('app.supabase_url', true)
    )
  );
EXCEPTION WHEN undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;
