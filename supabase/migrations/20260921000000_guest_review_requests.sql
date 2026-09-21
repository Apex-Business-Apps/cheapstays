-- Guest review request tokens. Hosts trigger these via the
-- `send-guest-review-request` edge function; guests submit anonymously via
-- `guest-review-submit` using the token, which then inserts into `reviews`.

CREATE TABLE IF NOT EXISTS public.review_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  token                TEXT NOT NULL UNIQUE,
  host_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id           UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  guest_email          TEXT NOT NULL,
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_count         INT NOT NULL DEFAULT 0,
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  submitted_review_id  UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
  submitted_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One review request per booking. Resends update the same row.
CREATE UNIQUE INDEX IF NOT EXISTS review_requests_booking_unique
  ON public.review_requests (booking_id);

CREATE INDEX IF NOT EXISTS review_requests_host_id_idx
  ON public.review_requests (host_id);

CREATE INDEX IF NOT EXISTS review_requests_guest_id_idx
  ON public.review_requests (guest_id);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

-- Hosts can see review requests they sent.
CREATE POLICY "Hosts read own review requests"
  ON public.review_requests
  FOR SELECT
  TO authenticated
  USING (host_id = auth.uid());

-- Admins read all.
CREATE POLICY "Admins read all review requests"
  ON public.review_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Writes go through service role only (edge functions). No INSERT/UPDATE/DELETE
-- policies for authenticated / anon.

COMMENT ON TABLE public.review_requests IS
  'Host-initiated guest review invitations. Tokens are anonymous and single-use, minted by send-guest-review-request and consumed by guest-review-submit.';
