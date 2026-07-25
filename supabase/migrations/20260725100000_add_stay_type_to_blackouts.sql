-- ============================================================
-- Add stay_type to listing_blackout_dates so hosts can block a
-- specific stay mode (e.g. an external overnight booking on
-- Airbnb) without also killing hourly availability on the same
-- date. Existing rows default to 'both' — no behavioral change
-- for anything already in the table.
-- ============================================================

ALTER TABLE public.listing_blackout_dates
  ADD COLUMN IF NOT EXISTS stay_type TEXT NOT NULL DEFAULT 'both';

ALTER TABLE public.listing_blackout_dates
  DROP CONSTRAINT IF EXISTS listing_blackout_dates_stay_type_check;

ALTER TABLE public.listing_blackout_dates
  ADD CONSTRAINT listing_blackout_dates_stay_type_check
  CHECK (stay_type IN ('hourly','overnight','both'));
