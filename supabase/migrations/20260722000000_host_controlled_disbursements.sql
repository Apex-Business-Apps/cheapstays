-- ============================================================
-- MIGRATION: Host-Controlled Manual Disbursements
-- CheapStays | JGP Corporation | 2026-07-22
--
-- Replaces the automatic monthly payout cron with a manual,
-- host-initiated flow. The admin uploads proof of an off-platform
-- payment; the host confirms receipt to close the loop.
-- ============================================================

-- ── 1. Extend disbursement_requests ─────────────────────────────
ALTER TABLE disbursement_requests
  ADD COLUMN IF NOT EXISTS proof_image_path text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'manual';

ALTER TABLE disbursement_requests
  DROP CONSTRAINT IF EXISTS valid_disburse_status;

ALTER TABLE disbursement_requests
  ADD CONSTRAINT valid_disburse_status
  CHECK (status IN ('pending','processing','completed','failed','retrying','awaiting_confirmation','released','rejected'));

ALTER TABLE disbursement_requests
  DROP CONSTRAINT IF EXISTS one_payout_per_wallet_per_cycle;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_disbursement_in_flight
  ON disbursement_requests (wallet_id)
  WHERE status IN ('pending', 'awaiting_confirmation');

CREATE INDEX IF NOT EXISTS idx_disbursement_requests_requested_at
  ON disbursement_requests (requested_at DESC);

-- ── 2. Storage bucket for admin-uploaded payment proofs ─────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'disbursement-proofs',
  'disbursement-proofs',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
) ON CONFLICT (id) DO NOTHING;

-- Only admins can upload
CREATE POLICY "Admins upload disbursement proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'disbursement-proofs'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Admins can read all proofs
CREATE POLICY "Admins read disbursement proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'disbursement-proofs'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Hosts can read proofs for their own wallet's requests.
-- Path convention: {wallet_id}/{disbursement_id}.{ext}
CREATE POLICY "Hosts read own disbursement proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'disbursement-proofs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.host_wallets WHERE host_id = auth.uid()
    )
  );

-- ── 3. Unschedule the monthly cron ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cheapstays-monthly-host-payouts') THEN
    PERFORM cron.unschedule('cheapstays-monthly-host-payouts');
  END IF;
END $$;
