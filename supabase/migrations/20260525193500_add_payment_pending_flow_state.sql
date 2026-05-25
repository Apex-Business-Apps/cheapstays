-- Allow provisional short-term reservations created by book-listing.
-- This keeps backend flow_state validation aligned with edge-function state machine.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_flow_state_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_flow_state_check
    CHECK (flow_state IN (
      'payment_pending',
      'requested',
      'approved',
      'auto_approved',
      'active',
      'cancel_requested',
      'replacement_offered',
      'replacement_accepted',
      'refunded',
      'completed',
      'expired'
    ));

-- Keep the active-booking index semantics explicit: provisional holds also
-- block inventory until they expire or transition.
DROP INDEX IF EXISTS bookings_active_idx;
CREATE INDEX IF NOT EXISTS bookings_active_idx
  ON public.bookings (listing_id, check_in, check_out)
  WHERE flow_state IN ('payment_pending', 'active', 'approved', 'auto_approved', 'replacement_accepted');
