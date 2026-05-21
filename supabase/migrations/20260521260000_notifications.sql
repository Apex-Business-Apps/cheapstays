CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages notifications"
  ON notifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger: create notification on booking status change
CREATE OR REPLACE FUNCTION notify_booking_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO notifications (user_id, type, title, body, data)
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

CREATE TRIGGER booking_status_notification
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION notify_booking_status();
