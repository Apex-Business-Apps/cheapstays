-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.listing_status AS ENUM ('draft', 'active', 'inactive', 'suspended');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.payment_method AS ENUM ('gcash', 'maya', 'card', 'bank_transfer', 'cash');
CREATE TYPE public.listing_type AS ENUM ('entire_place', 'private_room', 'shared_room', 'glamping', 'villa', 'resort');
CREATE TYPE public.host_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- =========================================
-- HOST PROFILES
-- =========================================
CREATE TABLE public.host_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         TEXT,
  bio                  TEXT,
  phone                TEXT,
  location             TEXT,
  id_photo_url         TEXT,
  selfie_url           TEXT,
  verification_status  public.host_verification_status NOT NULL DEFAULT 'unverified',
  verified_at          TIMESTAMPTZ,
  response_rate        INT DEFAULT 0 CHECK (response_rate BETWEEN 0 AND 100),
  total_listings       INT DEFAULT 0,
  total_bookings       INT DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;

-- Public can view verified host profiles; owner can always view own
CREATE POLICY "Public can view verified host profiles"
  ON public.host_profiles FOR SELECT
  USING (
    verification_status = 'verified'
    OR auth.uid() = user_id
  );

-- Authenticated users can insert only their own host profile
CREATE POLICY "Users can create their own host profile"
  ON public.host_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner can update own profile; admin can update any
CREATE POLICY "Owner or admin can update host profile"
  ON public.host_profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_host_profiles_updated_at
  BEFORE UPDATE ON public.host_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_host_profiles_user_id ON public.host_profiles(user_id);
CREATE INDEX idx_host_profiles_verification ON public.host_profiles(verification_status);

-- =========================================
-- LISTINGS
-- =========================================
CREATE TABLE public.listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE,
  description      TEXT,
  type             public.listing_type NOT NULL DEFAULT 'entire_place',
  city             TEXT NOT NULL,
  province         TEXT NOT NULL,
  address          TEXT,
  lat              NUMERIC(10,7),
  lng              NUMERIC(10,7),
  bedrooms         SMALLINT DEFAULT 1 CHECK (bedrooms >= 0),
  bathrooms        NUMERIC(3,1) DEFAULT 1,
  max_guests       SMALLINT DEFAULT 2 CHECK (max_guests >= 1),
  nightly_php      NUMERIC(10,2) NOT NULL CHECK (nightly_php > 0),
  min_nights       SMALLINT DEFAULT 1 CHECK (min_nights >= 1),
  amenities        TEXT[] DEFAULT '{}',
  images           JSONB DEFAULT '[]',
  is_owner_direct  BOOLEAN NOT NULL DEFAULT true,
  instant_book     BOOLEAN NOT NULL DEFAULT false,
  status           public.listing_status NOT NULL DEFAULT 'active',
  avg_rating       NUMERIC(3,2) DEFAULT NULL,
  review_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read active listings
CREATE POLICY "Anyone can view active listings"
  ON public.listings FOR SELECT
  USING (status = 'active');

-- Hosts can view their own listings regardless of status
CREATE POLICY "Hosts can view their own listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (host_id = auth.uid());

-- Admins can view all listings
CREATE POLICY "Admins can view all listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users with host role can create listings
CREATE POLICY "Hosts can create listings"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND public.has_role(auth.uid(), 'host')
  );

-- Host can update/delete own listing; admin can update/delete any
CREATE POLICY "Host or admin can update listing"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (
    host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Host or admin can delete listing"
  ON public.listings FOR DELETE
  TO authenticated
  USING (
    host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_listings_host_id ON public.listings(host_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_city ON public.listings(city);
CREATE INDEX idx_listings_province ON public.listings(province);
CREATE INDEX idx_listings_type ON public.listings(type);
CREATE INDEX idx_listings_nightly_php ON public.listings(nightly_php);

-- =========================================
-- BOOKINGS
-- =========================================
CREATE TABLE public.bookings (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id                   UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  guest_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  host_id                      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  check_in                     DATE NOT NULL,
  check_out                    DATE NOT NULL,
  nights                       SMALLINT NOT NULL,
  guests                       SMALLINT NOT NULL DEFAULT 1,
  total_php                    NUMERIC(10,2) NOT NULL,
  status                       public.booking_status NOT NULL DEFAULT 'pending',
  payment_status               public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method               public.payment_method,
  payment_ref                  TEXT,
  paymongo_payment_intent_id   TEXT,
  guest_message                TEXT,
  host_notes                   TEXT,
  confirmed_at                 TIMESTAMPTZ,
  cancelled_at                 TIMESTAMPTZ,
  cancellation_reason          TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Guest, host, or admin can view bookings
CREATE POLICY "Guest, host, or admin can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    guest_id = auth.uid()
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Authenticated users can create bookings as themselves
CREATE POLICY "Authenticated users can create their own bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (guest_id = auth.uid());

-- Guest can update own pending bookings; host can update their bookings; admin can update any
CREATE POLICY "Guest can update own pending bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    (guest_id = auth.uid() AND status = 'pending')
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (guest_id = auth.uid() AND status = 'pending')
    OR host_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bookings_listing_id ON public.bookings(listing_id);
CREATE INDEX idx_bookings_guest_id ON public.bookings(guest_id);
CREATE INDEX idx_bookings_host_id ON public.bookings(host_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_check_in ON public.bookings(check_in);

-- =========================================
-- REVIEWS
-- =========================================
CREATE TABLE public.reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID UNIQUE NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  listing_id    UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT CHECK (length(body) <= 2000),
  is_public     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read public reviews
CREATE POLICY "Anyone can view public reviews"
  ON public.reviews FOR SELECT
  USING (is_public = true);

-- Authenticated reviewers can see their own non-public reviews too
CREATE POLICY "Reviewers can view their own reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (reviewer_id = auth.uid());

-- Admins can view all reviews
CREATE POLICY "Admins can view all reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert reviews only for their own bookings
CREATE POLICY "Reviewers can create reviews for their own bookings"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.guest_id = auth.uid()
        AND b.status = 'completed'
    )
  );

-- Reviewer or admin can update/delete reviews
CREATE POLICY "Reviewer or admin can update reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    reviewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Reviewer or admin can delete reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_reviews_listing_id ON public.reviews(listing_id);
CREATE INDEX idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX idx_reviews_host_id ON public.reviews(host_id);
CREATE INDEX idx_reviews_booking_id ON public.reviews(booking_id);

-- =========================================
-- TRIGGER: Keep listings.avg_rating and review_count in sync
-- =========================================
CREATE OR REPLACE FUNCTION public.refresh_listing_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id UUID;
BEGIN
  -- Determine which listing_id to refresh
  IF TG_OP = 'DELETE' THEN
    v_listing_id := OLD.listing_id;
  ELSE
    v_listing_id := NEW.listing_id;
  END IF;

  UPDATE public.listings
  SET
    avg_rating   = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM public.reviews
      WHERE listing_id = v_listing_id
        AND is_public = true
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE listing_id = v_listing_id
        AND is_public = true
    )
  WHERE id = v_listing_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_listing_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_listing_rating();

-- =========================================
-- GRANT PERMISSIONS
-- =========================================

-- anon: read-only access to public-facing tables
GRANT SELECT ON public.listings TO anon;
GRANT SELECT ON public.host_profiles TO anon;
GRANT SELECT ON public.reviews TO anon;

-- authenticated: full access per RLS
GRANT SELECT, INSERT, UPDATE ON public.listings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.host_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
