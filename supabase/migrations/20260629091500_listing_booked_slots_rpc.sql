-- ============================================================
-- Public availability lookup for the booking widget.
--
-- The bookings table RLS only lets a booking's own guest/host/admin SELECT it,
-- so browsing users (and anonymous guests) could never see which dates/hours
-- were already taken — the calendar/time disabling silently did nothing.
--
-- This SECURITY DEFINER function exposes ONLY the availability-relevant fields
-- (no guest_id, no contact, no payment data) for confirmed/pending bookings of
-- a single listing, so the UI can disable taken dates and hourly slots.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_listing_booked_slots(p_listing_id uuid)
RETURNS TABLE (
  check_in text,
  check_out text,
  stay_type text,
  arrival_time text,
  duration_hours int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.check_in::text,
    b.check_out::text,
    b.stay_type::text,
    b.arrival_time::text,
    b.duration_hours
  FROM public.bookings b
  WHERE b.listing_id = p_listing_id
    AND b.status IN ('confirmed', 'pending');
$$;

GRANT EXECUTE ON FUNCTION public.get_listing_booked_slots(uuid) TO anon, authenticated;
