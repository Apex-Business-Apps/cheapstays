-- Wallet payout scheduler: reconcile missing credit rows, then release matured
-- pending balances into available balance daily.
--
-- Context:
--   The prior monthly host-payout cron (`cheapstays-monthly-host-payouts`)
--   was unscheduled on 2026-07-22 in favour of a host-controlled disbursement
--   flow, but the "pending -> available" release path was never re-wired.
--   `release-pending-balance` has zero callers anywhere in the codebase, so
--   money credited to `host_wallets.pending_balance` stays there forever and
--   `request-disbursement` refuses to open a request (available < 500).
--
--   Additionally, `paymongo-webhook/index.ts:119-124` calls `credit-host-wallet`
--   fire-and-forget — a transient error swallows the credit silently and no
--   `credit_pending` ledger row is written.
--
-- This migration schedules two daily jobs:
--   cheapstays-wallet-credit-reconcile — 01:30 Asia/Manila (17:30 UTC)
--     Sweeps paid+confirmed bookings that have no `credit_pending` ledger row
--     and credits the host's pending_balance.
--
--   cheapstays-wallet-release-sweep    — 02:00 Asia/Manila (18:00 UTC)
--     Sweeps paid bookings whose `payout_release_on` has elapsed and moves
--     the host earnings from pending_balance -> available_balance.
--
-- Reconcile runs 30 min before release so any freshly-repaired credit rows
-- from the same day can be released in the same night if their payout window
-- has elapsed.
--
-- Requires extensions: pg_cron, pg_net (see §1 of CLAUDE.md).
-- Migration is idempotent: stale jobs are unscheduled before re-creation.

-- Remove stale schedules if re-running migration.
DO $$
BEGIN
  DELETE FROM cron.job
  WHERE jobname IN (
    'cheapstays-wallet-credit-reconcile',
    'cheapstays-wallet-release-sweep'
  );
EXCEPTION WHEN undefined_table THEN
  NULL; -- pg_cron not installed; skip
END;
$$;

-- Schedule: cheapstays-wallet-credit-reconcile (daily 17:30 UTC / 01:30 Asia/Manila)
DO $$
BEGIN
  PERFORM cron.schedule(
    'cheapstays-wallet-credit-reconcile',
    '30 17 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/wallet-credit-reconcile',
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

-- Schedule: cheapstays-wallet-release-sweep (daily 18:00 UTC / 02:00 Asia/Manila)
DO $$
BEGIN
  PERFORM cron.schedule(
    'cheapstays-wallet-release-sweep',
    '0 18 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url     := %L || '/functions/v1/wallet-release-sweep',
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
