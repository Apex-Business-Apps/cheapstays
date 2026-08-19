-- Wallet cron auth via Supabase Vault (fix for the broken GUC pattern).
--
-- Context:
--   The prior scheduler migration (20260818000000_wallet_release_scheduler.sql)
--   authorized cron POSTs with:
--     'Bearer ' || current_setting('app.service_role_key', true)
--   Supabase's hosted `postgres` role is not allowed to run
--     ALTER DATABASE ... SET app.service_role_key = ...
--   (returns "42501: permission denied to set parameter"), so that GUC was
--   always NULL. Every cron tick POSTed with `Bearer ` (empty) and the
--   edge functions returned 401. Confirmed on 2026-08-19: money credited
--   to host wallets sat in pending forever, no disbursement requests could
--   open.
--
--   The same broken pattern lives in 20250527000000_host_wallet_system.sql
--   (the `cheapstays-monthly-host-payouts` cron), but that cron was already
--   unscheduled by 20260722000000_host_controlled_disbursements.sql and is
--   not re-enabled here. If the manual disbursement flow is ever reversed,
--   the resurrected cron must adopt the Vault pattern below.
--
-- Fix:
--   Read the service_role key from Supabase Vault at each cron tick.
--   The Vault secret name `service_role_key` must exist — created out-of-
--   band via the Dashboard SQL Editor (secret cannot be checked into git):
--     SELECT vault.create_secret(
--       '<service_role_key>', 'service_role_key',
--       'Service role key for pg_cron edge function invocations'
--     );
--   The URL is hardcoded — the project ref is stable and public.

-- Remove the stale schedules (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cheapstays-wallet-credit-reconcile') THEN
    PERFORM cron.unschedule('cheapstays-wallet-credit-reconcile');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cheapstays-wallet-release-sweep') THEN
    PERFORM cron.unschedule('cheapstays-wallet-release-sweep');
  END IF;
EXCEPTION WHEN undefined_table OR undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

-- Reschedule with Vault-based auth.
-- Reconcile at 01:30 Asia/Manila (17:30 UTC) — 30 min before release so
-- freshly-repaired credit rows can be released the same night if eligible.
DO $$
BEGIN
  PERFORM cron.schedule(
    'cheapstays-wallet-credit-reconcile',
    '30 17 * * *',
    $sql$
    SELECT net.http_post(
      url     := 'https://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1/wallet-credit-reconcile',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'service_role_key' LIMIT 1
        )
      ),
      body    := '{}'::jsonb
    )
    $sql$
  );
EXCEPTION WHEN undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

-- Release sweep at 02:00 Asia/Manila (18:00 UTC).
DO $$
BEGIN
  PERFORM cron.schedule(
    'cheapstays-wallet-release-sweep',
    '0 18 * * *',
    $sql$
    SELECT net.http_post(
      url     := 'https://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1/wallet-release-sweep',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'service_role_key' LIMIT 1
        )
      ),
      body    := '{}'::jsonb
    )
    $sql$
  );
EXCEPTION WHEN undefined_function THEN
  NULL; -- pg_cron not installed; skip
END;
$$;
