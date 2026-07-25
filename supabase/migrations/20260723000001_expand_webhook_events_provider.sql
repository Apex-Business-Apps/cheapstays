-- Stay-voucher webhook writes provider='paymongo_stay_voucher'. Extend the
-- pre-existing CHECK constraint on webhook_events.provider to include it.
-- Without this, the idempotency insert silently fails and duplicate events
-- reprocess.

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_provider_check;

ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_provider_check
  CHECK (provider IN ('stripe', 'paymongo', 'paymongo_stay_voucher'));
