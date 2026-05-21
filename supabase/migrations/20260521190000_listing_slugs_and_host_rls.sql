-- Auto-generate slugs for listings
CREATE OR REPLACE FUNCTION public.generate_listing_slug(title text, listing_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    substring(
      regexp_replace(
        regexp_replace(lower(title), '[^a-z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      1, 60
    ) || '-' || left(listing_id::text, 8);
$$;

CREATE OR REPLACE FUNCTION public.set_listing_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_listing_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_auto_slug ON public.listings;
CREATE TRIGGER listing_auto_slug
  BEFORE INSERT OR UPDATE OF title ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_listing_slug();

-- Backfill existing listings that have null slugs
UPDATE public.listings
SET slug = public.generate_listing_slug(title, id)
WHERE slug IS NULL OR slug = '';

-- Ensure hosts can insert their own listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listings' AND policyname = 'Hosts can insert own listings'
  ) THEN
    CREATE POLICY "Hosts can insert own listings"
      ON public.listings FOR INSERT
      WITH CHECK (
        host_id = auth.uid()
        AND public.has_role(auth.uid(), 'host')
      );
  END IF;
END $$;

-- Ensure hosts can update their own listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listings' AND policyname = 'Hosts can update own listings'
  ) THEN
    CREATE POLICY "Hosts can update own listings"
      ON public.listings FOR UPDATE
      USING (host_id = auth.uid())
      WITH CHECK (host_id = auth.uid());
  END IF;
END $$;
