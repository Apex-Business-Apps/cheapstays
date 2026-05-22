-- =========================================
-- HOST APPLICATIONS
-- KYC-gated host onboarding. Applicants submit full legal name,
-- phone, property details, government ID, and selfie.
-- Admins review and issue a grant_host OmniHub command to approve.
-- =========================================

-- Private storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'host-verification',
  'host-verification',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
) ON CONFLICT (id) DO NOTHING;

-- Applicants can upload their own KYC docs; only admins/service_role can read
CREATE POLICY "Users upload own KYC docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'host-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read KYC docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'host-verification'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users read own KYC docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'host-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Host applications table
CREATE TABLE public.host_applications (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contact & identity
  full_legal_name      text        NOT NULL,
  phone                text        NOT NULL,

  -- Property overview
  property_type        text        NOT NULL,
  city                 text        NOT NULL,
  province             text        NOT NULL,
  property_description text        NOT NULL,

  -- KYC documents (storage object paths)
  id_type              text        NOT NULL,
  id_front_path        text,
  selfie_path          text,

  -- Review state
  status               text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at          timestamptz,
  rejection_reason     text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicant reads own application"
  ON public.host_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Applicant inserts own application"
  ON public.host_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Applicant updates own pending application"
  ON public.host_applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins read all applications"
  ON public.host_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages applications"
  ON public.host_applications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_host_applications_updated_at
  BEFORE UPDATE ON public.host_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_host_applications_status ON public.host_applications(status);
CREATE INDEX idx_host_applications_user   ON public.host_applications(user_id);
