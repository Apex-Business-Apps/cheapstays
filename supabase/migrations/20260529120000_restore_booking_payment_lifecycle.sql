-- Restore production booking/payment lifecycle invariants.
-- Root cause: the prior PayMongo webhook RPC wrote bookings.paid_at without
-- adding that column, and it never advanced paid bookings from the canonical
-- payment_pending/approved flow states into active inventory.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.process_paymongo_paid_webhook(
  p_booking_id UUID,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payment_id TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_from_state TEXT;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking % not found for PayMongo webhook %', p_booking_id, p_event_id;
  END IF;

  v_from_state := v_booking.flow_state;

  UPDATE public.bookings
  SET
    payment_status = 'paid',
    payment_state = 'captured',
    paid_at = COALESCE(paid_at, now()),
    paymongo_payment_id = COALESCE(p_payment_id, paymongo_payment_id),
    flow_state = CASE
      WHEN flow_state IN ('payment_pending', 'approved', 'auto_approved') THEN 'active'
      ELSE flow_state
    END,
    status = CASE
      WHEN flow_state IN ('payment_pending', 'approved', 'auto_approved') THEN 'confirmed'::public.booking_status
      ELSE status
    END,
    confirmed_at = CASE
      WHEN flow_state IN ('payment_pending', 'approved', 'auto_approved') THEN COALESCE(confirmed_at, now())
      ELSE confirmed_at
    END,
    updated_at = now()
  WHERE id = p_booking_id;

  IF v_from_state IN ('payment_pending', 'approved', 'auto_approved') THEN
    INSERT INTO public.booking_transitions
      (booking_id, from_state, to_state, actor_user_id, actor_role, reason, metadata)
    VALUES
      (
        p_booking_id,
        v_from_state,
        'active',
        NULL,
        'system',
        'paymongo_checkout_session_paid',
        jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type, 'payment_id', p_payment_id)
      );
  END IF;

  INSERT INTO public.webhook_events(provider, event_id, event_type, booking_id, processed_at)
  VALUES ('paymongo', p_event_id, p_event_type, p_booking_id, now());
END;
$$;

-- Repair stale provisional holds without using non-existent payment_status enum values.
CREATE OR REPLACE FUNCTION public.expire_pending_bookings() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET
    flow_state = 'expired',
    status = 'cancelled',
    payment_status = CASE
      WHEN payment_status = 'paid' THEN payment_status
      ELSE 'failed'::public.payment_status
    END,
    payment_state = CASE
      WHEN payment_state IS NULL OR payment_state IN ('intent_created', 'failed') THEN 'failed'::public.payment_state
      ELSE payment_state
    END,
    updated_at = now()
  WHERE flow_state = 'payment_pending'
    AND payment_status IN ('unpaid', 'pending', 'failed')
    AND created_at < now() - INTERVAL '2 hours';
END;
$$;

DO $$
BEGIN
  DELETE FROM cron.job WHERE jobname = 'expire-pending-booking-payments';
  PERFORM cron.schedule(
    'expire-pending-booking-payments',
    '*/10 * * * *',
    'SELECT public.expire_pending_bookings();'
  );
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    NULL;
END;
$$;
