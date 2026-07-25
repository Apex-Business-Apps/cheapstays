-- ============================================================
-- Add optional hour range to listing_blackout_dates.
--
-- When start_time and end_time are both set, the blackout blocks
-- only that intra-day slot on the given date (single-day only).
-- When both are NULL, behavior is unchanged: the blackout blocks
-- the entire date range as before.
--
-- Only meaningful for stay_type = 'hourly' (a partial-day block
-- for overnight or 'both' does not model a real world scenario),
-- but we do not add a hard CHECK for that so callers can still
-- widen an existing hourly hold to full-day by clearing the times.
-- ============================================================

ALTER TABLE public.listing_blackout_dates
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;

-- Both times must be set together, and start < end.
ALTER TABLE public.listing_blackout_dates
  DROP CONSTRAINT IF EXISTS listing_blackout_dates_time_pair;
ALTER TABLE public.listing_blackout_dates
  ADD CONSTRAINT listing_blackout_dates_time_pair
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  );

-- When a time range is set, the blackout must sit on a single date
-- (avoids ambiguity across midnight — a multi-day hourly hold is
-- better modeled as two rows).
ALTER TABLE public.listing_blackout_dates
  DROP CONSTRAINT IF EXISTS listing_blackout_dates_time_single_day;
ALTER TABLE public.listing_blackout_dates
  ADD CONSTRAINT listing_blackout_dates_time_single_day
  CHECK (start_time IS NULL OR start_date = end_date);
