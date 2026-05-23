-- ============================================================
-- 1. Webhook idempotency table
-- Used by stripe-webhook and payment-webhook edge functions
-- to detect and skip already-processed events.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT        NOT NULL CHECK (provider IN ('stripe', 'paymongo')),
  event_id     TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  booking_id   UUID        REFERENCES public.bookings(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_id_key UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event
  ON public.webhook_events (provider, event_id);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge functions) may read or write this table.
CREATE POLICY "Service role manages webhook events"
  ON public.webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. Security linter fixes
-- ============================================================

-- 2a. cleanup_rate_limits() — SECURITY DEFINER without SET search_path
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- 2b. notify_booking_status() — SECURITY DEFINER without SET search_path
CREATE OR REPLACE FUNCTION public.notify_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.guest_id,
      'booking_status',
      CASE NEW.status
        WHEN 'confirmed' THEN 'Booking Confirmed!'
        WHEN 'cancelled' THEN 'Booking Cancelled'
        WHEN 'completed' THEN 'Stay Completed'
        ELSE 'Booking Update'
      END,
      'Your booking status has changed to: ' || NEW.status,
      jsonb_build_object('booking_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2c. "Service role manages notifications" — USING (true) allows any role.
--     Restrict to service_role explicitly.
DROP POLICY IF EXISTS "Service role manages notifications" ON public.notifications;

CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2d. "Service role manages all push subscriptions" — uses current_setting('role')
--     which is a session variable, not the JWT role. Replace with TO service_role.
DROP POLICY IF EXISTS "Service role manages all push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Service role manages all push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
