-- Allow anonymous voucher-buyer reviews.
--
-- Voucher purchases have no auth.users row (buyer only exists on
-- stay_voucher_purchases.buyer_email). To let those buyers leave a review of
-- their stay via the guest-review flow, we relax the reviews + review_requests
-- schemas so the reviewer identity can be captured as a snapshot instead of a
-- FK.

-- ── reviews ─────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews
  ALTER COLUMN reviewer_id DROP NOT NULL;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_name_snapshot  TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_email_snapshot TEXT;

-- Either the reviewer is a real user OR we have a name snapshot for them.
-- (Email snapshot is optional — for privacy we don't require it.)
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewer_identity_present;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewer_identity_present
  CHECK (reviewer_id IS NOT NULL OR reviewer_name_snapshot IS NOT NULL);

COMMENT ON COLUMN public.reviews.reviewer_name_snapshot IS
  'Display name captured at review-time when reviewer_id is NULL (anonymous voucher buyers).';
COMMENT ON COLUMN public.reviews.reviewer_email_snapshot IS
  'Email captured at review-time when reviewer_id is NULL. Not exposed publicly.';

-- ── review_requests ─────────────────────────────────────────────────────────
ALTER TABLE public.review_requests
  ALTER COLUMN guest_id DROP NOT NULL;

ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS guest_name_snapshot TEXT;

ALTER TABLE public.review_requests
  DROP CONSTRAINT IF EXISTS review_requests_guest_identity_present;

ALTER TABLE public.review_requests
  ADD CONSTRAINT review_requests_guest_identity_present
  CHECK (guest_id IS NOT NULL OR guest_name_snapshot IS NOT NULL);

COMMENT ON COLUMN public.review_requests.guest_id IS
  'Reviewer''s auth.users id if they have an account. NULL for anonymous voucher buyers.';
COMMENT ON COLUMN public.review_requests.guest_name_snapshot IS
  'Buyer name captured at send-time when guest_id is NULL (anonymous voucher buyers).';
