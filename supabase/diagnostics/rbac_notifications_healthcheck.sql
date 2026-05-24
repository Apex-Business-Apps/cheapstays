-- RBAC + notifications healthcheck
-- Optional: set target admin email for checks.
-- \set target_admin_email 'admin@example.com'

-- RBAC counts
SELECT role, COUNT(*) AS count
FROM public.user_roles
GROUP BY role
ORDER BY role;

-- Admin existence check (replace placeholder value before running)
-- SELECT id, email FROM auth.users WHERE email = :'target_admin_email';

-- has_role existence + grants
SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'has_role';

SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='public' AND routine_name='has_role'
ORDER BY grantee, privilege_type;

-- user_roles policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='user_roles';

-- notifications counts
SELECT user_id, COUNT(*) AS count
FROM public.notifications
GROUP BY user_id
ORDER BY count DESC
LIMIT 20;

-- notifications policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='notifications';

-- legacy trigger/function checks
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_schema='public' AND event_object_table='bookings'
  AND trigger_name IN ('booking_status_notification','notify_booking_status');

SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('notify_booking_status','notify_booking_status_change');

-- Optional JWT-context harness checks (run in authenticated session):
-- SELECT auth.uid() AS current_uid;
-- SELECT * FROM public.user_roles WHERE user_id = auth.uid();
-- UPDATE public.notifications SET read = true WHERE user_id = auth.uid() AND read = false;
