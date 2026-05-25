-- ============================================================
-- Phase 4: Listing publish gates + host setup tables
--
-- Adds infrastructure so a listing cannot transition from draft to active
-- without:
--   1. 3-month forward availability declared
--   2. Blackout dates declared (can be an empty set, but must be explicit)
--   3. min_nights AND max_nights set
--   4. short_term_enabled OR long_term_enabled (at least one)
--   5. House rules accepted (versioned via legal_consent_acceptances)
--   6. Stay instructions present
--
-- Tables added:
--   - listing_availability_windows: explicit 3-month declaration record
--   - listing_blackout_dates: blackout date ranges
--   - listing_house_rules: current version pointer per listing
--   - listing_stay_instructions: check-in/out, wifi, etc.
--
-- Publishing is gated by a CHECK at the application layer (Host.tsx +
-- ListingPublishGate.tsx) AND by an enforcement trigger on listings.status
-- transitions to 'active'.
-- ============================================================

-- ── 1. listing_availability_windows ───────────────────────────────────────────
-- One row per host per listing recording that they declared their forward
-- availability window through the host UI. The presence of a row covering
-- "now + 90 days" satisfies the publish gate.
CREATE TABLE IF NOT EXISTS public.listing_availability_windows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  declared_through DATE NOT NULL,
  declared_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_availability_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read availability windows"
  ON public.listing_availability_windows FOR SELECT
  USING (true);

CREATE POLICY "Host or admin can write availability windows"
  ON public.listing_availability_windows FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ── 2. listing_blackout_dates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_blackout_dates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT  blackout_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS listing_blackout_dates_listing_idx
  ON public.listing_blackout_dates (listing_id, start_date);

ALTER TABLE public.listing_blackout_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blackout dates"
  ON public.listing_blackout_dates FOR SELECT
  USING (true);

CREATE POLICY "Host or admin can write blackout dates"
  ON public.listing_blackout_dates FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Blackout edits must not overlap CONFIRMED future bookings (locked rule).
-- Enforced by trigger on INSERT/UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.guard_blackout_vs_confirmed_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_listing_id UUID;
  v_start DATE;
  v_end   DATE;
  v_conflict_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Deleting a blackout is always permitted — it relaxes restrictions.
    RETURN OLD;
  END IF;

  v_listing_id := NEW.listing_id;
  v_start := NEW.start_date;
  v_end   := NEW.end_date;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings b
  WHERE b.listing_id = v_listing_id
    AND b.flow_state IN ('approved','auto_approved','active','replacement_offered','replacement_accepted')
    AND b.check_in <= v_end
    AND b.check_out > v_start;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Cannot add/edit blackout dates that overlap a confirmed booking on this listing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_blackout_guard_trg ON public.listing_blackout_dates;
CREATE TRIGGER listing_blackout_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.listing_blackout_dates
  FOR EACH ROW EXECUTE FUNCTION public.guard_blackout_vs_confirmed_bookings();

-- ── 3. listing_house_rules ────────────────────────────────────────────────────
-- A pointer record. The actual rule content + version + hash is stored in
-- legal_consent_acceptances (context_id = listing_id, document_id =
-- 'house-rules') so the immutable audit trail captures every change.
CREATE TABLE IF NOT EXISTS public.listing_house_rules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id         UUID NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  current_version    TEXT NOT NULL,
  current_hash       TEXT NOT NULL,
  rules_json         JSONB NOT NULL,
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_house_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read house rules"
  ON public.listing_house_rules FOR SELECT
  USING (true);

CREATE POLICY "Host or admin can write house rules"
  ON public.listing_house_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ── 4. listing_stay_instructions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_stay_instructions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id         UUID NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  check_in_window    TEXT NOT NULL,
  check_out_time     TEXT NOT NULL,
  access_instructions TEXT NOT NULL,
  wifi_details       TEXT,
  emergency_contact  TEXT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_stay_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests with confirmed bookings can read stay instructions"
  ON public.listing_stay_instructions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b
            WHERE b.listing_id = listing_stay_instructions.listing_id
              AND b.guest_id = auth.uid()
              AND b.flow_state IN ('approved','auto_approved','active','replacement_accepted','completed'))
    OR EXISTS (SELECT 1 FROM public.listings l
               WHERE l.id = listing_stay_instructions.listing_id
                 AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Host or admin can write stay instructions"
  ON public.listing_stay_instructions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_stay_instructions.listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listings l
            WHERE l.id = listing_stay_instructions.listing_id AND l.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ── 5. Publish-gate: prevent listings.status → 'active' without setup ─────────
CREATE OR REPLACE FUNCTION public.guard_listing_publish_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_through DATE;
  v_has_house_rules BOOLEAN;
  v_has_stay_instructions BOOLEAN;
  v_min_required_through DATE := (CURRENT_DATE + INTERVAL '90 days')::date;
BEGIN
  -- Only enforce when transitioning into 'active'.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'active' THEN
    -- Already active; allow other column changes to proceed.
    RETURN NEW;
  END IF;

  -- min_nights and max_nights both required.
  IF NEW.min_nights IS NULL OR NEW.max_nights IS NULL THEN
    RAISE EXCEPTION 'Cannot publish listing: min_nights and max_nights are required';
  END IF;

  -- At least one stay-length channel enabled.
  IF NOT NEW.short_term_enabled AND NOT NEW.long_term_enabled THEN
    RAISE EXCEPTION 'Cannot publish listing: enable short-term, long-term, or both';
  END IF;

  -- 3-month forward availability window declared.
  SELECT declared_through INTO v_window_through
  FROM public.listing_availability_windows
  WHERE listing_id = NEW.id;
  IF v_window_through IS NULL OR v_window_through < v_min_required_through THEN
    RAISE EXCEPTION 'Cannot publish listing: declare availability through %', v_min_required_through;
  END IF;

  -- House rules present.
  SELECT EXISTS (SELECT 1 FROM public.listing_house_rules WHERE listing_id = NEW.id)
    INTO v_has_house_rules;
  IF NOT v_has_house_rules THEN
    RAISE EXCEPTION 'Cannot publish listing: house rules must be set';
  END IF;

  -- Stay instructions present.
  SELECT EXISTS (SELECT 1 FROM public.listing_stay_instructions WHERE listing_id = NEW.id)
    INTO v_has_stay_instructions;
  IF NOT v_has_stay_instructions THEN
    RAISE EXCEPTION 'Cannot publish listing: stay instructions must be set';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_publish_gate_trg ON public.listings;
CREATE TRIGGER listing_publish_gate_trg
  BEFORE INSERT OR UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_publish_gate();

-- ── 6. Grants ─────────────────────────────────────────────────────────────────
GRANT SELECT ON public.listing_availability_windows TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_availability_windows TO authenticated;

GRANT SELECT ON public.listing_blackout_dates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_blackout_dates TO authenticated;

GRANT SELECT ON public.listing_house_rules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_house_rules TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_stay_instructions TO authenticated;
