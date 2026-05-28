-- Lock down direct client-side DML on bookings.
-- Booking creation and state transitions are server-owned via Edge Functions
-- using the service role; authenticated clients should not write bookings
-- directly through PostgREST.

REVOKE INSERT, UPDATE ON public.bookings FROM authenticated;

-- Keep read access for guest/host UX queries.
GRANT SELECT ON public.bookings TO authenticated;

-- Defense in depth: remove broad authenticated INSERT policy so future grants
-- cannot silently re-open direct booking creation.
DROP POLICY IF EXISTS "Authenticated users can create their own bookings" ON public.bookings;
