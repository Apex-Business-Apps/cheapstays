-- ============================================================
-- Repair: widen bookings check constraints to include hourly + voucher combos.
--
-- Phase 1 (20260620120000_phase1_domain_schema.sql) already defined the wider
-- constraints, but on at least one live database the migration was not applied,
-- leaving the pre-phase-1 constraint (short_term/instant_book OR
-- long_term/request_booking only) in place. That caused hourly guest bookings
-- to fail with `bookings_routing_coherence_check`. Re-declare the constraints
-- idempotently so any DB missing the phase 1 apply catches up.
-- ============================================================

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
    (stay_type = 'short_term'  AND booking_flow = 'instant_book')
    OR (stay_type = 'long_term'   AND booking_flow = 'request_booking')
    OR (stay_type = 'hourly'      AND booking_flow = 'instant_book')
    OR (stay_type = 'voucher'     AND booking_flow = 'voucher')
    OR (stay_type = 'hourly'      AND booking_flow = 'voucher')
  );
