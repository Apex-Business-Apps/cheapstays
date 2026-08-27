-- One-off ops script (2026-08-24)
-- ================================
-- Ran after migration 20260823000000_fix_payout_account_encryption_storage.sql
-- which wiped every host_payout_accounts row because the pre-existing
-- encryption pipeline stored unrecoverable ciphertext.
--
-- Purpose:
--   1. List every in-flight disbursement request whose target payout
--      account no longer exists.
--   2. Notify each affected host (in-app notification) that they must
--      re-enter their payout details before their request can be paid.
--   3. Leave the requests intact — admins decide per-case whether to
--      reject-and-refund (via admin-reject-disbursement) or hold until
--      the host re-adds their account.
--
-- Run these blocks in Supabase Dashboard → SQL Editor, one at a time.
-- Do not commit into supabase/migrations/ — this is a one-shot op, not
-- a repeatable schema change.


-- ---------------------------------------------------------------------
-- Step 1. Dry-run: see who is affected.
-- ---------------------------------------------------------------------

SELECT
  dr.id               AS disbursement_id,
  dr.status,
  dr.amount,
  dr.requested_at,
  hw.host_id,
  p.display_name      AS host_name,
  u.email             AS host_email,
  CASE
    WHEN hpa.host_id IS NULL THEN 'NO ACCOUNT (needs re-entry)'
    ELSE 'account present'
  END AS payout_account_status
FROM public.disbursement_requests dr
JOIN public.host_wallets hw       ON hw.id = dr.wallet_id
LEFT JOIN public.profiles p        ON p.user_id = hw.host_id
LEFT JOIN auth.users u             ON u.id = hw.host_id
LEFT JOIN public.host_payout_accounts hpa ON hpa.host_id = hw.host_id
WHERE dr.status IN ('pending', 'awaiting_confirmation')
ORDER BY dr.requested_at DESC;


-- ---------------------------------------------------------------------
-- Step 2. Insert in-app notifications for affected hosts (idempotent).
--
-- Skips hosts who already got this exact notification (guards against
-- re-running the script). One notification per affected host, not per
-- request — hosts with multiple in-flight requests still get one clean
-- heads-up.
-- ---------------------------------------------------------------------

WITH affected_hosts AS (
  SELECT DISTINCT hw.host_id
  FROM public.disbursement_requests dr
  JOIN public.host_wallets hw ON hw.id = dr.wallet_id
  LEFT JOIN public.host_payout_accounts hpa ON hpa.host_id = hw.host_id
  WHERE dr.status IN ('pending', 'awaiting_confirmation')
    AND hpa.host_id IS NULL
)
INSERT INTO public.notifications (user_id, type, title, body, data)
SELECT
  ah.host_id,
  'payout_account_reset',
  'Action needed: re-add your payout details',
  'We rebuilt our payout account storage on 2026-08-24 and had to clear all saved bank/GCash details. Your pending payout request is still on file — please re-add your account in Wallet → Payout account so we can send your funds.',
  jsonb_build_object('reason', 'encryption_migration_20260823')
FROM affected_hosts ah
WHERE NOT EXISTS (
  SELECT 1 FROM public.notifications n
  WHERE n.user_id = ah.host_id
    AND n.type   = 'payout_account_reset'
);


-- ---------------------------------------------------------------------
-- Step 3. (Optional) Bulk-reject all in-flight requests with a system
-- reason, refunding each host's wallet. Uncomment ONLY if product
-- decides to reset the queue rather than hold. Prefer the admin UI
-- per-case; this is here for completeness.
--
-- WARNING: bypasses the admin-reject-disbursement edge function which
-- handles notifications separately. If you run this, insert your own
-- rejection notifications afterwards.
-- ---------------------------------------------------------------------

-- BEGIN;
--   -- Refund each request's amount back to available_balance
--   UPDATE public.host_wallets hw
--   SET available_balance = hw.available_balance + dr.amount
--   FROM public.disbursement_requests dr
--   WHERE dr.wallet_id = hw.id
--     AND dr.status IN ('pending', 'awaiting_confirmation');
--
--   -- Mark the requests rejected
--   UPDATE public.disbursement_requests
--   SET status = 'rejected',
--       rejected_at = NOW(),
--       rejection_reason = 'Auto-rejected during payout encryption migration (2026-08-24). Please re-add your payout account and re-request.'
--   WHERE status IN ('pending', 'awaiting_confirmation');
--
--   -- Insert a debit_failed_reversal ledger row per request
--   -- (mirrors admin-reject-disbursement behavior — schema-dependent, adjust
--   -- to match your wallet_ledger columns before uncommenting).
-- COMMIT;
