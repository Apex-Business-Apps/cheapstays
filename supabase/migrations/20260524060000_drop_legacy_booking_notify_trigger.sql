-- external/live-only: legacy object names may exist only in long-lived environments
-- Notifications cleanup: drop legacy notify_booking_status trigger if present.
--
-- The new flow_state machine dispatches notifications from edge functions
-- via _shared/notify.ts. A DB-side trigger that fired on bookings.status
-- changes would now double-fire on every flow_state update that also
-- mirrors the coarse status — and worse, it would fire from the scheduler
-- and webhook paths bypassing user-preference checks. Drop it cleanly.

DROP TRIGGER IF EXISTS notify_booking_status ON public.bookings;
DROP FUNCTION IF EXISTS public.notify_booking_status_change();
