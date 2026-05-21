INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT u.id, 'admin'::app_role, u.id FROM auth.users u
WHERE u.email = 'cheapstays.me@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;