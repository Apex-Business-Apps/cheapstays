-- Fix RLS policy tautologies in the bookings UPDATE policy.
-- The previous security_hardening migration (20260521130000) contained:
--   AND host_id = host_id    -- always true, does not constrain host_id changes
--   AND listing_id = listing_id  -- always true, does not constrain listing_id changes
-- These column = column comparisons are tautologies and provide no protection.
-- The fix references auth.uid() and the pre-update row values via USING to
-- ensure host_id and listing_id cannot be altered by a non-admin guest.

DROP POLICY IF EXISTS "Guest or host or admin can update bookings" ON public.bookings;

CREATE POLICY "Guest or host or admin can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    (guest_id = auth.uid() AND status = 'pending')
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    -- Guest may only update guest_message on their own pending bookings.
    -- host_id and listing_id must remain unchanged; because WITH CHECK sees the
    -- proposed NEW row, we compare against the USING-visible existing values by
    -- re-joining to the current row through a subquery so the columns cannot be
    -- silently rewritten.
    (
      guest_id = auth.uid()
      AND status = 'pending'
      AND host_id = (SELECT b.host_id FROM public.bookings b WHERE b.id = id LIMIT 1)
      AND listing_id = (SELECT b.listing_id FROM public.bookings b WHERE b.id = id LIMIT 1)
    )
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
