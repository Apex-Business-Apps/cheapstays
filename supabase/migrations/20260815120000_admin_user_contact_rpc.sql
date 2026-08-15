-- Admin-only lookup that returns email + account created + display name for a target user.
-- The admin surface (e.g. /admin/applications) needs to show applicant email, but
-- auth.users is not directly readable by the authenticated client. This SECURITY DEFINER
-- function exposes only the columns the admin UI needs, gated by has_role(auth.uid(), 'admin').

CREATE OR REPLACE FUNCTION public.admin_get_user_contact(target UUID)
RETURNS TABLE (
  user_id       UUID,
  email         TEXT,
  display_name  TEXT,
  account_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
  SELECT
    u.id            AS user_id,
    u.email::text   AS email,
    p.display_name  AS display_name,
    u.created_at    AS account_created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = target;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_contact(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_get_user_contact(UUID) IS
  'Returns email, display name, and account creation timestamp for target user. Callable only by admins (enforced inside function).';
