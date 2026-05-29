-- ============================================================
-- FIX: Backfill listing_availability_windows for all active listings
--
-- ROOT CAUSE: Phase 4 migration (20260524040000) created the
-- listing_availability_windows table but did NOT backfill rows for
-- existing listings. The book-listing edge function gates on the
-- presence of this row and rejects with 409 "declared_availability_exceeded"
-- for any listing that lacks one, blocking 100% of bookings.
--
-- This migration:
-- 1. Inserts a 1-year availability window for every active listing
--    that does not yet have a row (idempotent via ON CONFLICT DO NOTHING).
-- 2. Ensures seed listings get short_term_enabled = true and max_nights = NULL
--    (uncapped) so the routing logic in book-listing can pass.
-- 3. Applies to ALL listing statuses so host-created listings in any
--    state are covered when they become active.
-- ============================================================

-- 1. Backfill availability windows: 1 year forward for every listing
--    that has no row yet. ON CONFLICT DO NOTHING is safe for re-runs.
INSERT INTO public.listing_availability_windows (listing_id, declared_through, declared_at, updated_at)
SELECT
  l.id,
  CURRENT_DATE + INTERVAL '365 days',
  now(),
  now()
FROM public.listings l
WHERE NOT EXISTS (
  SELECT 1
  FROM public.listing_availability_windows w
  WHERE w.listing_id = l.id
)
ON CONFLICT (listing_id) DO NOTHING;

-- 2. Ensure short_term_enabled is true for any listing where both flags
--    are false (cannot be booked at all — this is a data integrity gap
--    from listings created before Phase 4 added the columns).
UPDATE public.listings
SET short_term_enabled = true
WHERE short_term_enabled = false
  AND long_term_enabled  = false;

-- 3. Reset max_nights to NULL for listings where the Phase 2 backfill
--    set max_nights = 30 on seed listings. NULL = uncapped, which is the
--    correct default for a property with no explicit upper bound.
--    Only applies to listings whose max_nights was set by the migration
--    backfill (= 30) AND for which the host has NOT explicitly configured
--    a max (i.e., listings with synthetic host_id 000...001 from seed SQL).
--
--    SAFE: book-listing treats NULL max_nights as "no upper bound".
--    Host-configured max_nights values are preserved for all real hosts.
UPDATE public.listings
SET max_nights = NULL
WHERE max_nights = 30
  AND host_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 4. Grant service_role access to the availability windows table
--    (defensive: may already exist, but ensures edge functions can read it).
GRANT SELECT, INSERT, UPDATE ON public.listing_availability_windows TO service_role;
GRANT SELECT ON public.listing_availability_windows TO authenticated;
GRANT SELECT ON public.listing_availability_windows TO anon;
