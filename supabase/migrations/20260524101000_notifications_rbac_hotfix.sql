-- Notifications RBAC hotfix: owner read/update(read-only) + service role full access

DROP TRIGGER IF EXISTS booking_status_notification ON public.bookings;
DROP FUNCTION IF EXISTS public.notify_booking_status();
-- wrong historical names cleanup (external/live-only): previous migrations used incorrect object names
DROP TRIGGER IF EXISTS notify_booking_status ON public.bookings;
DROP FUNCTION IF EXISTS public.notify_booking_status_change();

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notification read state" ON public.notifications;
DROP POLICY IF EXISTS "Service role manages notifications" ON public.notifications;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notification read state"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.enforce_notification_read_only_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.id <> OLD.id
      OR NEW.user_id <> OLD.user_id
      OR NEW.type <> OLD.type
      OR NEW.title <> OLD.title
      OR NEW.body <> OLD.body
      OR NEW.data IS DISTINCT FROM OLD.data
      OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Authenticated users may only update read state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_enforce_read_only_update ON public.notifications;
CREATE TRIGGER notifications_enforce_read_only_update
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_read_only_update();
