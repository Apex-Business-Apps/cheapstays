-- ============================================================
-- Phase 1: Domain Foundation (PPTX Parity)
-- ============================================================

-- ── 1. Extend Listings Table ──────────────────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS stay_availability_type TEXT CHECK (stay_availability_type IN ('hourly', 'overnight', 'both')),
  ADD COLUMN IF NOT EXISTS stay_category TEXT CHECK (stay_category IN ('quick_stay', 'hourly_stay', 'overnight_stay', 'hostel', 'private_pool', 'condo', 'apartment', 'hotel_room', 'motel_room')),
  ADD COLUMN IF NOT EXISTS booking_mode TEXT CHECK (booking_mode IN ('instant', 'voucher', 'manual_review')),
  ADD COLUMN IF NOT EXISTS hourly_php NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_3h NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_6h NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_12h NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS overnight_php NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10,2);

-- Backfill existing listings
UPDATE public.listings
SET
  overnight_php = nightly_php,
  stay_availability_type = 'overnight',
  stay_category = CASE
    WHEN type = 'entire_place' THEN 'condo'
    WHEN type = 'private_room' THEN 'hotel_room'
    WHEN type = 'shared_room' THEN 'hostel'
    WHEN type = 'villa' THEN 'private_pool'
    WHEN type = 'resort' THEN 'hotel_room'
    WHEN type = 'glamping' THEN 'hourly_stay'
    ELSE 'overnight_stay'
  END,
  booking_mode = CASE
    WHEN instant_book = true THEN 'instant'
    ELSE 'manual_review'
  END
WHERE overnight_php IS NULL;

-- ── 2. Extend Bookings Constraints ──────────────────────────────────────────
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_stay_type_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_stay_type_check
  CHECK (stay_type IN ('short_term', 'long_term', 'hourly', 'voucher'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_flow_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_flow_check
  CHECK (booking_flow IN ('instant_book', 'request_booking', 'voucher'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_routing_coherence_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_routing_coherence_check
  CHECK (
    (stay_type = 'short_term' AND booking_flow = 'instant_book')
    OR (stay_type = 'long_term'  AND booking_flow = 'request_booking')
    OR (stay_type = 'hourly' AND booking_flow = 'instant_book')
    OR (stay_type = 'voucher' AND booking_flow = 'voucher')
    OR (stay_type = 'hourly' AND booking_flow = 'voucher')
  );

-- ── 3. Vouchers Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'refunded')),
  amount_paid NUMERIC(10,2) NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vouchers_guest_id_idx ON public.vouchers(guest_id);
CREATE INDEX IF NOT EXISTS vouchers_listing_id_idx ON public.vouchers(listing_id);
CREATE INDEX IF NOT EXISTS vouchers_code_idx ON public.vouchers(code);

-- RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests can view their own vouchers" ON public.vouchers;
CREATE POLICY "Guests can view their own vouchers"
  ON public.vouchers FOR SELECT
  USING (auth.uid() = guest_id);

DROP POLICY IF EXISTS "Hosts can view vouchers for their listings" ON public.vouchers;
CREATE POLICY "Hosts can view vouchers for their listings"
  ON public.vouchers FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM public.listings WHERE host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages vouchers" ON public.vouchers;
CREATE POLICY "Service role manages vouchers"
  ON public.vouchers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
