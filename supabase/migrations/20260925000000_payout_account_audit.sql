-- ============================================================
-- MIGRATION: Payout account change audit trail
-- CheapStays | JGP Corporation
--
-- Problem: host_payout_accounts is edited in place. When a host
-- swaps their GCash/Maya/bank number and the admin later approves,
-- there is no record of the old value or of who changed what and
-- when. If a host swaps details minutes before approval we cannot
-- reconstruct what was actually approved.
--
-- Solution:
--   1. host_payout_account_audit table — one immutable row per
--      INSERT / UPDATE on host_payout_accounts, with masked
--      before/after snapshots + actor + change_kind.
--   2. last_actor_id column on host_payout_accounts. Edge functions
--      set this on every write so the AFTER trigger can attribute
--      the change. Column-level privilege is revoked from anon /
--      authenticated so clients cannot forge attribution via
--      PostgREST.
--   3. Trigger fires AFTER the existing BEFORE-verification-reset
--      trigger (see 20260707000000), so the recorded after_state
--      reflects the post-reset row.
-- ============================================================

ALTER TABLE public.host_payout_accounts
  ADD COLUMN IF NOT EXISTS last_actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

REVOKE UPDATE (last_actor_id) ON public.host_payout_accounts FROM anon, authenticated;
REVOKE INSERT (last_actor_id) ON public.host_payout_accounts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.host_payout_account_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_kind  TEXT NOT NULL CHECK (change_kind IN ('create','update','verify','verification_reset')),
  before_state JSONB,
  after_state  JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hpa_audit_host_id
  ON public.host_payout_account_audit (host_id, changed_at DESC);

ALTER TABLE public.host_payout_account_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY hpa_audit_admin_read
  ON public.host_payout_account_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT / UPDATE / DELETE policies — only service_role writes,
-- and no path can mutate a row after it lands (immutable trail).

-- ------------------------------------------------------------
-- Masking helper. account_number_enc is currently plaintext TEXT
-- (see 20260823000000_fix_payout_account_encryption_storage.sql).
-- We never store the full value in the audit table.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mask_payout_number(p TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p IS NULL OR length(p) = 0 THEN RETURN NULL; END IF;
  IF length(p) <= 4 THEN RETURN repeat('*', length(p)); END IF;
  RETURN repeat('*', length(p) - 4) || right(p, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------
-- Trigger: capture every write to host_payout_accounts.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payout_account_change()
RETURNS TRIGGER AS $$
DECLARE
  v_before JSONB;
  v_after  JSONB;
  v_kind   TEXT;
BEGIN
  v_after := jsonb_build_object(
    'payout_method',        NEW.payout_method,
    'account_holder_name',  NEW.account_holder_name,
    'account_number_masked', public.mask_payout_number(NEW.account_number_enc),
    'is_verified',          NEW.is_verified,
    'verified_by',          NEW.verified_by,
    'verified_at',          NEW.verified_at
  );

  IF TG_OP = 'INSERT' THEN
    v_kind := 'create';
    v_before := NULL;
  ELSE
    v_before := jsonb_build_object(
      'payout_method',        OLD.payout_method,
      'account_holder_name',  OLD.account_holder_name,
      'account_number_masked', public.mask_payout_number(OLD.account_number_enc),
      'is_verified',          OLD.is_verified,
      'verified_by',          OLD.verified_by,
      'verified_at',          OLD.verified_at
    );

    -- Skip no-op updates (only updated_at changed).
    IF v_before = v_after THEN
      RETURN NULL;
    END IF;

    IF OLD.is_verified = false AND NEW.is_verified = true THEN
      v_kind := 'verify';
    ELSIF OLD.is_verified = true AND NEW.is_verified = false THEN
      -- Reset by 20260707 BEFORE trigger when details changed while verified.
      v_kind := 'verification_reset';
    ELSE
      v_kind := 'update';
    END IF;
  END IF;

  INSERT INTO public.host_payout_account_audit
    (host_id, actor_id, change_kind, before_state, after_state)
  VALUES
    (NEW.host_id, NEW.last_actor_id, v_kind, v_before, v_after);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS host_payout_accounts_audit ON public.host_payout_accounts;
CREATE TRIGGER host_payout_accounts_audit
  AFTER INSERT OR UPDATE ON public.host_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.record_payout_account_change();
