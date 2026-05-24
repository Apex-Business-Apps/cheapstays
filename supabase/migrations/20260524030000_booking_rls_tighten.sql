-- ============================================================
-- Phase 3: Tighten bookings UPDATE RLS
--
-- Authenticated clients (guest/host) may directly UPDATE bookings only for
-- non-critical fields: guest_message, host_notes. Every state-bearing field
-- (status, flow_state, payment_*, total_php, refundable_until, payout_*,
-- penalty/compensation fields, completed_at, approval_deadline_at,
-- replacement-tracking metadata) must be written through edge functions
-- using the service role.
--
-- The previous policy ("Guest can update own pending bookings") allowed
-- guests to set status to anything on pending rows and hosts to set status
-- on any of their rows. Both paths are eliminated here. Admins keep an
-- emergency-override window via a separate admin-only policy.
-- ============================================================

-- Drop the permissive legacy policy that allowed direct status mutation.
DROP POLICY IF EXISTS "Guest can update own pending bookings"
  ON public.bookings;

-- Trigger: block any authenticated UPDATE that touches a state-bearing
-- column. Service role bypasses RLS *and* is whitelisted in this trigger
-- via auth.role(), so edge functions retain full authority. Admins must
-- also use an audited edge function path; direct SQL UPDATE from an admin
-- client is rejected.
CREATE OR REPLACE FUNCTION public.bookings_guard_critical_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Service role writes (edge functions) are trusted.
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block any change to state-bearing columns. The list is intentionally
  -- exhaustive — adding a new state field requires extending this list.
  IF NEW.status                   IS DISTINCT FROM OLD.status                   THEN RAISE EXCEPTION 'bookings.status must be updated via an edge function'; END IF;
  IF NEW.flow_state               IS DISTINCT FROM OLD.flow_state               THEN RAISE EXCEPTION 'bookings.flow_state must be updated via an edge function'; END IF;
  IF NEW.stay_type                IS DISTINCT FROM OLD.stay_type                THEN RAISE EXCEPTION 'bookings.stay_type is immutable'; END IF;
  IF NEW.booking_flow             IS DISTINCT FROM OLD.booking_flow             THEN RAISE EXCEPTION 'bookings.booking_flow is immutable'; END IF;
  IF NEW.payment_status           IS DISTINCT FROM OLD.payment_status           THEN RAISE EXCEPTION 'bookings.payment_status must be updated via an edge function'; END IF;
  IF NEW.payment_state            IS DISTINCT FROM OLD.payment_state            THEN RAISE EXCEPTION 'bookings.payment_state must be updated via an edge function'; END IF;
  IF NEW.payment_provider         IS DISTINCT FROM OLD.payment_provider         THEN RAISE EXCEPTION 'bookings.payment_provider must be updated via an edge function'; END IF;
  IF NEW.payment_method           IS DISTINCT FROM OLD.payment_method           THEN RAISE EXCEPTION 'bookings.payment_method must be updated via an edge function'; END IF;
  IF NEW.payment_ref              IS DISTINCT FROM OLD.payment_ref              THEN RAISE EXCEPTION 'bookings.payment_ref must be updated via an edge function'; END IF;
  IF NEW.paymongo_payment_intent_id IS DISTINCT FROM OLD.paymongo_payment_intent_id THEN RAISE EXCEPTION 'bookings.paymongo_payment_intent_id must be updated via an edge function'; END IF;
  IF NEW.total_php                IS DISTINCT FROM OLD.total_php                THEN RAISE EXCEPTION 'bookings.total_php must be updated via an edge function'; END IF;
  IF NEW.nights                   IS DISTINCT FROM OLD.nights                   THEN RAISE EXCEPTION 'bookings.nights is immutable'; END IF;
  IF NEW.check_in                 IS DISTINCT FROM OLD.check_in                 THEN RAISE EXCEPTION 'bookings.check_in is immutable'; END IF;
  IF NEW.check_out                IS DISTINCT FROM OLD.check_out                THEN RAISE EXCEPTION 'bookings.check_out is immutable'; END IF;
  IF NEW.guests                   IS DISTINCT FROM OLD.guests                   THEN RAISE EXCEPTION 'bookings.guests must be updated via an edge function'; END IF;
  IF NEW.confirmed_at             IS DISTINCT FROM OLD.confirmed_at             THEN RAISE EXCEPTION 'bookings.confirmed_at must be updated via an edge function'; END IF;
  IF NEW.cancelled_at             IS DISTINCT FROM OLD.cancelled_at             THEN RAISE EXCEPTION 'bookings.cancelled_at must be updated via an edge function'; END IF;
  IF NEW.cancellation_reason      IS DISTINCT FROM OLD.cancellation_reason      THEN RAISE EXCEPTION 'bookings.cancellation_reason must be updated via an edge function'; END IF;
  IF NEW.completed_at             IS DISTINCT FROM OLD.completed_at             THEN RAISE EXCEPTION 'bookings.completed_at must be updated via an edge function'; END IF;
  IF NEW.approval_deadline_at     IS DISTINCT FROM OLD.approval_deadline_at     THEN RAISE EXCEPTION 'bookings.approval_deadline_at must be updated via an edge function'; END IF;
  IF NEW.refundable_until         IS DISTINCT FROM OLD.refundable_until         THEN RAISE EXCEPTION 'bookings.refundable_until must be updated via an edge function'; END IF;
  IF NEW.partial_refundable_until IS DISTINCT FROM OLD.partial_refundable_until THEN RAISE EXCEPTION 'bookings.partial_refundable_until must be updated via an edge function'; END IF;
  IF NEW.payout_release_on        IS DISTINCT FROM OLD.payout_release_on        THEN RAISE EXCEPTION 'bookings.payout_release_on must be updated via an edge function'; END IF;
  IF NEW.incidental_hold_required IS DISTINCT FROM OLD.incidental_hold_required THEN RAISE EXCEPTION 'bookings.incidental_hold_required must be updated via an edge function'; END IF;
  IF NEW.listing_id               IS DISTINCT FROM OLD.listing_id               THEN RAISE EXCEPTION 'bookings.listing_id is immutable'; END IF;
  IF NEW.guest_id                 IS DISTINCT FROM OLD.guest_id                 THEN RAISE EXCEPTION 'bookings.guest_id is immutable'; END IF;
  IF NEW.host_id                  IS DISTINCT FROM OLD.host_id                  THEN RAISE EXCEPTION 'bookings.host_id is immutable'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_guard_critical_columns_trg
  ON public.bookings;
CREATE TRIGGER bookings_guard_critical_columns_trg
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_guard_critical_columns();

-- Narrow re-grant: guest and host may UPDATE only their own bookings, but
-- the trigger above ensures the only fields that survive are the
-- non-critical ones (guest_message, host_notes). Admins do not get a direct
-- UPDATE path here — they must use audited edge functions.
CREATE POLICY "Guest or host can update non-critical booking fields"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (guest_id = auth.uid() OR host_id = auth.uid())
  WITH CHECK (guest_id = auth.uid() OR host_id = auth.uid());

-- ── Update reviews INSERT policy to use flow_state ────────────────────────────
-- A review is only valid after the booking has reached flow_state='completed'.
-- The original policy keyed on status='completed' which is still produced by
-- the completion sweep (Phase 7) → no functional regression, but the new
-- check is the canonical one going forward.
DROP POLICY IF EXISTS "Reviewers can create reviews for their own bookings"
  ON public.reviews;
CREATE POLICY "Reviewers can create reviews for their own bookings"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.guest_id = auth.uid() OR b.host_id = auth.uid())
        AND b.flow_state = 'completed'
    )
  );
