-- ============================================================
-- MIGRATION: Payout account verification hardening
-- CheapStays | JGP Corporation
--
-- 1. Audit trail: record which admin verified an account and when.
-- 2. DB-level guard: any change to payout details (method or
--    encrypted account number) resets is_verified so a once-verified
--    host cannot silently swap accounts and stay "Verified".
--    (Defense-in-depth: save-payout-account also resets it, but the
--    trigger covers every other write path.)
-- 3. Column-level privilege: clients cannot set verification fields
--    directly; only the service role (verify-payout-account, admin
--    gated) may write them.
-- ============================================================

ALTER TABLE host_payout_accounts
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.reset_payout_verification_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Encryption is non-deterministic (random IV), so a re-saved account
  -- number always produces a new ciphertext — every detail edit through
  -- the app drops verification, which is the intended behavior.
  IF OLD.is_verified
     AND NEW.is_verified
     AND (NEW.account_number_enc IS DISTINCT FROM OLD.account_number_enc
          OR NEW.payout_method IS DISTINCT FROM OLD.payout_method) THEN
    NEW.is_verified := false;
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS host_payout_accounts_reset_verification ON host_payout_accounts;
CREATE TRIGGER host_payout_accounts_reset_verification
  BEFORE UPDATE ON host_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.reset_payout_verification_on_account_change();

-- The "payout_account_own" RLS policy is FOR ALL, so without this a host
-- could UPDATE their own row and set is_verified = true via PostgREST.
REVOKE UPDATE (is_verified, verified_by, verified_at) ON host_payout_accounts FROM anon, authenticated;
REVOKE INSERT (is_verified, verified_by, verified_at) ON host_payout_accounts FROM anon, authenticated;
