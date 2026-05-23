-- Notification dispatch helpers
-- Adds a notify_user() SQL function for DB-level event triggers that respects
-- notification_preferences before inserting into notifications.

CREATE OR REPLACE FUNCTION notify_user(
  p_user_id   UUID,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT,
  p_data      JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefs       notification_preferences%ROWTYPE;
  v_category    TEXT;
  v_cat_enabled BOOLEAN := true;
  v_in_app      BOOLEAN := true;
BEGIN
  -- Map notification type → preferences column
  v_category := CASE p_type
    WHEN 'booking_status_changed' THEN 'booking_updates'
    WHEN 'payment_failed'         THEN 'payment_updates'
    WHEN 'verification_required'  THEN 'verification_updates'
    WHEN 'host_status_approved'   THEN 'host_status_updates'
    WHEN 'check_in_access_shared' THEN 'check_in_updates'
    WHEN 'refund_processed'       THEN 'refund_updates'
    WHEN 'payout_released'        THEN 'payout_updates'
    WHEN 'support_ticket_updated' THEN 'support_updates'
    WHEN 'evidence_requested'     THEN 'evidence_updates'
    WHEN 'dispute_status_changed' THEN 'dispute_updates'
    WHEN 'safety_admin_action'    THEN 'safety_critical_updates'
    ELSE NULL
  END;

  -- Load user preferences (missing row → all defaults = true)
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND THEN
    v_in_app := COALESCE(v_prefs.in_app_enabled, true);

    v_cat_enabled := CASE v_category
      WHEN 'booking_updates'         THEN COALESCE(v_prefs.booking_updates, true)
      WHEN 'payment_updates'         THEN COALESCE(v_prefs.payment_updates, true)
      WHEN 'verification_updates'    THEN COALESCE(v_prefs.verification_updates, true)
      WHEN 'host_status_updates'     THEN COALESCE(v_prefs.host_status_updates, true)
      WHEN 'check_in_updates'        THEN COALESCE(v_prefs.check_in_updates, true)
      WHEN 'refund_updates'          THEN COALESCE(v_prefs.refund_updates, true)
      WHEN 'payout_updates'          THEN COALESCE(v_prefs.payout_updates, true)
      WHEN 'support_updates'         THEN COALESCE(v_prefs.support_updates, true)
      WHEN 'evidence_updates'        THEN COALESCE(v_prefs.evidence_updates, true)
      WHEN 'dispute_updates'         THEN COALESCE(v_prefs.dispute_updates, true)
      WHEN 'safety_critical_updates' THEN COALESCE(v_prefs.safety_critical_updates, true)
      ELSE true
    END;
  END IF;

  IF v_in_app AND v_cat_enabled THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (p_user_id, p_type, p_title, p_body, p_data);
  END IF;
END;
$$;

-- Replace the simple booking trigger with one that uses notify_user()
-- so it respects notification preferences automatically.
CREATE OR REPLACE FUNCTION notify_booking_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    PERFORM notify_user(
      NEW.guest_id,
      'booking_status_changed',
      CASE NEW.status
        WHEN 'confirmed' THEN 'Booking confirmed!'
        WHEN 'cancelled' THEN 'Booking cancelled'
        WHEN 'completed' THEN 'Stay completed'
        ELSE 'Booking update'
      END,
      'Your booking status changed to: ' || NEW.status,
      jsonb_build_object('booking_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;
