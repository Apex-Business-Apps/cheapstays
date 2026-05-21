-- Security hardening: prevent non-admin users from self-escalating
-- host_profiles.verification_status to 'verified' or 'rejected'.
-- A user submitting their own host profile must only be able to set
-- the status to 'unverified' or 'pending'. Admins retain full control.

-- =========================================
-- FIX: host_profiles UPDATE policy
-- =========================================
DROP POLICY IF EXISTS "Owner or admin can update host profile" ON public.host_profiles;

CREATE POLICY "Owner or admin can update host profile"
  ON public.host_profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (
      -- Non-admin owners may only set status to unverified or pending
      auth.uid() = user_id
      AND verification_status IN ('unverified', 'pending')
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- =========================================
-- FIX: listings UPDATE policy
-- Prevent non-owner/non-admin from changing host_id (prevents listing hijacking)
-- =========================================
DROP POLICY IF EXISTS "Host or admin can update listing" ON public.listings;

CREATE POLICY "Host or admin can update listing"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (
    host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    -- Enforce host_id cannot be changed (stays as the original owner)
    host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- =========================================
-- FIX: bookings UPDATE policy
-- Prevent guests from changing listing_id, host_id, or total_php
-- (those are server-set values; only status/message changes allowed by guest)
-- =========================================
DROP POLICY IF EXISTS "Guest can update own pending bookings" ON public.bookings;

CREATE POLICY "Guest or host or admin can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    (guest_id = auth.uid() AND status = 'pending')
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    -- Guest may only update guest_message on their own pending bookings
    -- host_id, listing_id, total_php, payment_status cannot be changed by guest
    (
      guest_id = auth.uid()
      AND status = 'pending'
      AND host_id = host_id    -- host_id unchanged
      AND listing_id = listing_id  -- listing unchanged
    )
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- =========================================
-- FIX: Restrict public grants to minimum needed
-- Anon should only SELECT, not have any DML
-- =========================================
REVOKE INSERT, UPDATE, DELETE ON public.listings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.host_profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM anon;
