-- ============================================================
-- Phase 1: Booking Availability Schema
--
-- Additive foundation for stay-length-based routing:
--   listings:  short_term_enabled, long_term_enabled, max_nights
--   bookings:  stay_type, booking_flow, flow_state,
--              approval_deadline_at, completed_at, partial_refundable_until
--   payment_state enum: add 'expired'
--   booking_transitions: immutable audit trail of every state change
--
-- All changes are IF NOT EXISTS and additive. Coarse-legacy enums
-- (booking_status, payment_status) are preserved. No NOT NULL is set on a
-- new column until its backfill completes within this migration.
-- ============================================================

-- ── 1. Extend payment_state enum with 'expired' ───────────────────────────────
-- Not referenced elsewhere in this migration, so it is safe inside the tx.
ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'expired' AFTER 'failed';

-- ── 2. Listings: short/long term enablement + property-cap max_nights ─────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS short_term_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS long_term_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_nights         SMALLINT;

-- Backfill: existing listings get max_nights = 30 (preserves prior short-term
-- behavior). New listings default to NULL meaning "uncapped"; the edge
-- function treats NULL as no upper bound.
UPDATE public.listings
  SET max_nights = 30
  WHERE max_nights IS NULL;

-- ── 3. Bookings: parallel routing/state fields ────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stay_type                TEXT,
  ADD COLUMN IF NOT EXISTS booking_flow             TEXT,
  ADD COLUMN IF NOT EXISTS flow_state               TEXT,
  ADD COLUMN IF NOT EXISTS approval_deadline_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partial_refundable_until TIMESTAMPTZ;

-- Backfill stay_type / booking_flow from nights (deterministic).
UPDATE public.bookings
  SET stay_type    = CASE WHEN nights <= 30 THEN 'short_term' ELSE 'long_term' END,
      booking_flow = CASE WHEN nights <= 30 THEN 'instant_book' ELSE 'request_booking' END
  WHERE stay_type IS NULL OR booking_flow IS NULL;

-- Backfill flow_state from coarse legacy status. CASE covers every enum value.
UPDATE public.bookings
  SET flow_state = CASE status
        WHEN 'pending'   THEN 'requested'
        WHEN 'confirmed' THEN 'active'
        WHEN 'cancelled' THEN 'refunded'
        WHEN 'completed' THEN 'completed'
        WHEN 'no_show'   THEN 'completed'
      END
  WHERE flow_state IS NULL;

-- completed_at for already-completed rows (best-effort: latest known timestamp).
UPDATE public.bookings
  SET completed_at = COALESCE(updated_at, created_at)
  WHERE status = 'completed' AND completed_at IS NULL;

-- approval_deadline_at for long-term requests still pending (24h from creation).
UPDATE public.bookings
  SET approval_deadline_at = created_at + INTERVAL '24 hours'
  WHERE booking_flow = 'request_booking'
    AND flow_state = 'requested'
    AND approval_deadline_at IS NULL;

-- partial_refundable_until = check_in - 7 days (tier-aware refund boundary)
-- for non-cancelled rows. Cancelled rows leave this NULL.
UPDATE public.bookings
  SET partial_refundable_until = (check_in::timestamptz - INTERVAL '7 days')
  WHERE partial_refundable_until IS NULL
    AND status <> 'cancelled';

-- ── 4. Lock in NOT NULL + CHECK constraints (post-backfill) ───────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings'
      AND column_name='stay_type' AND is_nullable='YES'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN stay_type SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings'
      AND column_name='booking_flow' AND is_nullable='YES'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN booking_flow SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings'
      AND column_name='flow_state' AND is_nullable='YES'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN flow_state SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_stay_type_check;
ALTER TABLE public.bookings
  ADD  CONSTRAINT bookings_stay_type_check
    CHECK (stay_type IN ('short_term','long_term'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_flow_check;
ALTER TABLE public.bookings
  ADD  CONSTRAINT bookings_booking_flow_check
    CHECK (booking_flow IN ('instant_book','request_booking'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_flow_state_check;
ALTER TABLE public.bookings
  ADD  CONSTRAINT bookings_flow_state_check
    CHECK (flow_state IN (
      'requested','approved','auto_approved','active',
      'cancel_requested','replacement_offered','replacement_accepted',
      'refunded','completed','expired'
    ));

-- Routing coherence: short-term ⇔ instant_book; long-term ⇔ request_booking.
-- Prevents any path from inserting a mismatched pair, regardless of how the
-- write originated (edge function bug, manual SQL, etc.).
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_routing_coherence_check;
ALTER TABLE public.bookings
  ADD  CONSTRAINT bookings_routing_coherence_check
    CHECK (
      (stay_type = 'short_term' AND booking_flow = 'instant_book')
      OR
      (stay_type = 'long_term'  AND booking_flow = 'request_booking')
    );

-- ── 5. Indexes for routing/queue lookups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS bookings_flow_state_idx
  ON public.bookings (flow_state);

CREATE INDEX IF NOT EXISTS bookings_long_term_pending_idx
  ON public.bookings (approval_deadline_at)
  WHERE booking_flow = 'request_booking' AND flow_state = 'requested';

CREATE INDEX IF NOT EXISTS bookings_completion_sweep_idx
  ON public.bookings (check_out)
  WHERE flow_state = 'active';

CREATE INDEX IF NOT EXISTS listings_stay_enablement_idx
  ON public.listings (short_term_enabled, long_term_enabled);

-- ── 6. booking_transitions: immutable audit of every state change ─────────────
CREATE TABLE IF NOT EXISTS public.booking_transitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_state    TEXT,
  to_state      TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role    TEXT NOT NULL CHECK (actor_role IN ('guest','host','admin','system','scheduler')),
  reason        TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_transitions_booking_id_idx
  ON public.booking_transitions (booking_id, created_at DESC);

ALTER TABLE public.booking_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Booking participants can view transitions"
  ON public.booking_transitions;
CREATE POLICY "Booking participants can view transitions"
  ON public.booking_transitions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_transitions.booking_id
        AND (b.guest_id = auth.uid() OR b.host_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Service role manages booking_transitions"
  ON public.booking_transitions;
CREATE POLICY "Service role manages booking_transitions"
  ON public.booking_transitions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Immutability: UPDATE/DELETE blocked at the trigger level.
CREATE OR REPLACE FUNCTION public.prevent_booking_transition_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'booking_transitions is immutable';
END;
$$;

DROP TRIGGER IF EXISTS booking_transitions_prevent_update ON public.booking_transitions;
CREATE TRIGGER booking_transitions_prevent_update
  BEFORE UPDATE ON public.booking_transitions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_transition_mutation();

DROP TRIGGER IF EXISTS booking_transitions_prevent_delete ON public.booking_transitions;
CREATE TRIGGER booking_transitions_prevent_delete
  BEFORE DELETE ON public.booking_transitions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_transition_mutation();

-- Backfill: one initial transition row per existing booking so the audit
-- timeline is non-empty from day one.
INSERT INTO public.booking_transitions
  (booking_id, from_state, to_state, actor_role, reason, metadata, created_at)
SELECT
  b.id,
  NULL,
  b.flow_state,
  'system',
  'phase_1_backfill',
  jsonb_build_object(
    'legacy_status', b.status,
    'nights',        b.nights,
    'stay_type',     b.stay_type,
    'booking_flow',  b.booking_flow
  ),
  b.created_at
FROM public.bookings b
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_transitions t
  WHERE t.booking_id = b.id
);

-- ── 7. Grants ─────────────────────────────────────────────────────────────────
GRANT SELECT ON public.booking_transitions TO authenticated;
GRANT SELECT ON public.booking_transitions TO anon;
