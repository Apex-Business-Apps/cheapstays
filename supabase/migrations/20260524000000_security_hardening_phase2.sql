-- ============================================================
-- Security Hardening Phase 2
-- Addresses validated findings in the post-PR #43 audit:
--   E1. notify_user() SECURITY DEFINER missing SET search_path
--   E2. Missing REVOKE + scoped GRANT on sensitive SECURITY DEFINER functions
--   F.  listing-images storage bucket not defined in migrations
--   D.  host_applications UPDATE policy allows writing reviewed_* fields
--   D2. Remaining auth.role()='service_role' policies (use TO service_role)
-- ============================================================

-- ============================================================
-- E1. Fix notify_user() — add SET search_path = public
-- The prior version was SECURITY DEFINER without search_path,
-- which allows a malicious schema to shadow public tables/functions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id   UUID,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT,
  p_data      JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs       notification_preferences%ROWTYPE;
  v_category    TEXT;
  v_cat_enabled BOOLEAN := true;
  v_in_app      BOOLEAN := true;
BEGIN
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

-- ============================================================
-- E2. Restrict execute permissions on privileged SECURITY DEFINER functions.
--
-- Before these revokes, PUBLIC (all roles) could call these functions
-- via the PostgREST RPC endpoint or direct SQL. After:
--   execute_role_mutation  → service_role only (edge functions call via service key)
--   check_rate_limit       → service_role only (edge functions call via service key)
--   notify_user            → no direct callers; called by SECURITY DEFINER triggers
--                            running as postgres (superuser, no execute check applies)
--   is_suspended           → no direct callers; called from within execute_role_mutation
--                            (SECURITY DEFINER postgres context — no check applies)
--   auto_grant_admin_on_signup → trigger function; no direct callers needed
-- ============================================================

-- execute_role_mutation: revoke from PUBLIC, grant to service_role only
REVOKE EXECUTE ON FUNCTION public.execute_role_mutation(
  TEXT, TEXT, UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_role_mutation(
  TEXT, TEXT, UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT
) TO service_role;

-- check_rate_limit: revoke from PUBLIC, grant to service_role only
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TIMESTAMPTZ, INTEGER)
  TO service_role;

-- notify_user: revoke from PUBLIC entirely (postgres calls it as superuser via trigger)
REVOKE EXECUTE ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

-- is_suspended: revoke from PUBLIC (only called inside execute_role_mutation as postgres)
REVOKE EXECUTE ON FUNCTION public.is_suspended(UUID)
  FROM PUBLIC, anon, authenticated;

-- auto_grant_admin_on_signup: trigger function — revoke public direct-call access
REVOKE EXECUTE ON FUNCTION public.auto_grant_admin_on_signup()
  FROM PUBLIC, anon, authenticated;

-- cleanup_rate_limits: maintenance function — no external callers needed
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()
  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- F. Create listing-images storage bucket with policies.
-- The bucket is referenced by ImageUploader and VideoUploader but
-- was never defined in a migration, making it non-reproducible.
-- Paths follow the pattern: {user_id}/{listing_id}/{timestamp-random}.ext
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  104857600,  -- 100 MB (frontend enforces 5 MB for images)
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Anyone can view objects (bucket is public; getPublicUrl() used by frontend)
DROP POLICY IF EXISTS "Public can view listing images" ON storage.objects;
CREATE POLICY "Public can view listing images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

-- Authenticated users with host role can upload listing media
DROP POLICY IF EXISTS "Hosts can upload listing images" ON storage.objects;
CREATE POLICY "Hosts can upload listing images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND public.has_role(auth.uid(), 'host')
  );

-- Hosts can delete files in their own user_id folder; admins can delete any
DROP POLICY IF EXISTS "Hosts or admins can delete listing images" ON storage.objects;
CREATE POLICY "Hosts or admins can delete listing images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- ============================================================
-- D. Tighten host_applications UPDATE policy.
-- The prior policy only constrained status; applicants could freely
-- write reviewed_by, reviewed_at, and rejection_reason on their own
-- pending applications. The new WITH CHECK prevents those fields
-- from being set by the applicant (they must remain NULL while pending).
-- ============================================================
DROP POLICY IF EXISTS "Applicant updates own pending application"
  ON public.host_applications;

CREATE POLICY "Applicant updates own pending application"
  ON public.host_applications FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND rejection_reason IS NULL
  );

-- ============================================================
-- D2. Replace auth.role() = 'service_role' policies with TO service_role.
-- auth.role() reads from the JWT claim — correct in Supabase's PostgREST
-- layer but semantically wrong at the PostgreSQL role level.
-- The TO clause enforces the restriction at the Postgres role level.
-- Note: service_role bypasses RLS entirely in Supabase, so these policies
-- only matter for blocking direct (non-PostgREST) authenticated access.
-- ============================================================

-- ai_audit_logs
DROP POLICY IF EXISTS "Service role manages ai audit logs" ON public.ai_audit_logs;
CREATE POLICY "Service role manages ai audit logs"
  ON public.ai_audit_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- github_command_registry
DROP POLICY IF EXISTS "Service role manages command registry" ON public.github_command_registry;
CREATE POLICY "Service role manages command registry"
  ON public.github_command_registry FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- notification_preferences (service role policy)
DROP POLICY IF EXISTS "Service role manages preferences" ON public.notification_preferences;
CREATE POLICY "Service role manages preferences"
  ON public.notification_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- notification_templates (service role policy)
DROP POLICY IF EXISTS "Service role manages templates" ON public.notification_templates;
CREATE POLICY "Service role manages templates"
  ON public.notification_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- host_applications (service role policy)
DROP POLICY IF EXISTS "Service role manages applications" ON public.host_applications;
CREATE POLICY "Service role manages applications"
  ON public.host_applications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
