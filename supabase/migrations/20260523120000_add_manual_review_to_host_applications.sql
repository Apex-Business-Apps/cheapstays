-- Align host application state machine with approve-host-application function.
-- This allows admin review queues to mark applications as manual_review
-- before final approval.
ALTER TABLE public.host_applications
  DROP CONSTRAINT IF EXISTS host_applications_status_check;

ALTER TABLE public.host_applications
  ADD CONSTRAINT host_applications_status_check
  CHECK (status IN ('pending', 'manual_review', 'approved', 'rejected'));
