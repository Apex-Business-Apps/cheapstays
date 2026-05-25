-- Two-way rating system: guests rate hosts, hosts rate guests
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_role text NOT NULL DEFAULT 'guest'
    CHECK (reviewer_role IN ('guest', 'host')),
  ADD COLUMN IF NOT EXISTS reviewee_id uuid;

-- Backfill: existing reviews are all guest→host; reviewee is the host
UPDATE public.reviews SET reviewee_id = host_id WHERE reviewee_id IS NULL;

-- RLS: hosts can review guests they hosted on a confirmed booking
DROP POLICY IF EXISTS "Hosts can review guests" ON public.reviews;
CREATE POLICY "Hosts can review guests" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_role = 'host' AND
    reviewer_id = auth.uid() AND
    reviewee_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.guest_id = reviewee_id
        AND b.host_id = auth.uid()
        AND b.status = 'confirmed'
    )
  );
