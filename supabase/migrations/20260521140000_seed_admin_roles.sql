-- Grant admin role to designated CEO accounts.
-- Looks up users by email so no UUIDs or credentials are hardcoded.
-- A trigger handles the case where an account doesn't exist yet at
-- migration time (grants admin on first sign-up).

DO $$
DECLARE
  v_email  TEXT;
  v_uid    UUID;
  v_emails TEXT[] := ARRAY[
    'james.plofino.ceo@cheapstays.me',
    'jrmendozaceo@apexbusiness-systems.icu'
  ];
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_uid
    FROM auth.users
    WHERE email = v_email
      AND COALESCE(email_confirmed_at, confirmed_at) IS NOT NULL;
    IF v_uid IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_uid, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Trigger: auto-grant admin when a designated email signs up for the first time.
CREATE OR REPLACE FUNCTION public.auto_grant_admin_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IN (
    'james.plofino.ceo@cheapstays.me',
    'jrmendozaceo@apexbusiness-systems.icu'
  )
    AND COALESCE(NEW.email_confirmed_at, NEW.confirmed_at) IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_grant_admin ON auth.users;
CREATE TRIGGER trg_auto_grant_admin
  AFTER INSERT OR UPDATE OF email_confirmed_at, confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_on_signup();
