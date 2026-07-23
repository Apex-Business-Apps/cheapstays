-- ============================================================
-- Stay Vouchers: batches, codes, anonymous purchases, expiry cron,
-- redemption RPC, and a generic platform revenue event log.
-- Coexists with the existing hourly-voucher system (public.vouchers).
-- ============================================================

-- 1. stay_voucher_batches --------------------------------------

CREATE TABLE IF NOT EXISTS public.stay_voucher_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  batch_name   TEXT NOT NULL,
  nights       INT  NOT NULL CHECK (nights BETWEEN 1 AND 30),
  price_php    INT  NOT NULL CHECK (price_php > 0),
  quantity     INT  NOT NULL CHECK (quantity BETWEEN 1 AND 500),
  valid_days   INT  NOT NULL CHECK (valid_days BETWEEN 1 AND 14),
  terms        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_voucher_batches_listing_idx
  ON public.stay_voucher_batches(listing_id);
CREATE INDEX IF NOT EXISTS stay_voucher_batches_active_idx
  ON public.stay_voucher_batches(is_active) WHERE is_active = true;

ALTER TABLE public.stay_voucher_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active batches"
  ON public.stay_voucher_batches FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin manages batches"
  ON public.stay_voucher_batches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. stay_voucher_purchases ------------------------------------

CREATE TABLE IF NOT EXISTS public.stay_voucher_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES public.stay_voucher_batches(id) ON DELETE RESTRICT,
  quantity          INT  NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  buyer_name        TEXT NOT NULL,
  buyer_email       TEXT NOT NULL,
  buyer_phone       TEXT NOT NULL,
  subtotal_php      INT  NOT NULL,
  payment_provider  TEXT NOT NULL DEFAULT 'paymongo',
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('gcash','maya','card')),
  payment_ref       TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed')),
  success_token     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stay_voucher_purchases_batch_idx
  ON public.stay_voucher_purchases(batch_id);
CREATE INDEX IF NOT EXISTS stay_voucher_purchases_payment_ref_idx
  ON public.stay_voucher_purchases(payment_ref) WHERE payment_ref IS NOT NULL;

ALTER TABLE public.stay_voucher_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads purchases"
  ON public.stay_voucher_purchases FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages purchases"
  ON public.stay_voucher_purchases FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 3. stay_voucher_codes ----------------------------------------

CREATE TABLE IF NOT EXISTS public.stay_voucher_codes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id               UUID NOT NULL REFERENCES public.stay_voucher_batches(id) ON DELETE RESTRICT,
  code                   TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'unclaimed'
                         CHECK (status IN ('unclaimed','claimed','expired')),
  purchase_id            UUID NOT NULL REFERENCES public.stay_voucher_purchases(id) ON DELETE RESTRICT,
  booking_id             UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  valid_until            TIMESTAMPTZ NOT NULL,
  redeemed_by_host_id    UUID REFERENCES auth.users(id),
  redeemed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_voucher_codes_batch_idx
  ON public.stay_voucher_codes(batch_id);
CREATE INDEX IF NOT EXISTS stay_voucher_codes_status_valid_idx
  ON public.stay_voucher_codes(status, valid_until);

ALTER TABLE public.stay_voucher_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host reads codes for their listings"
  ON public.stay_voucher_codes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'host')
    AND batch_id IN (
      SELECT b.id
      FROM public.stay_voucher_batches b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE l.host_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages codes"
  ON public.stay_voucher_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages codes"
  ON public.stay_voucher_codes FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 4. platform_revenue_events -----------------------------------

CREATE TABLE IF NOT EXISTS public.platform_revenue_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                TEXT NOT NULL,
  amount_php            INT NOT NULL,
  stay_voucher_code_id  UUID REFERENCES public.stay_voucher_codes(id) ON DELETE SET NULL,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_revenue_events_source_idx
  ON public.platform_revenue_events(source, occurred_at DESC);

ALTER TABLE public.platform_revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads revenue events"
  ON public.platform_revenue_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages revenue events"
  ON public.platform_revenue_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 5. bookings.guest_name_snapshot ------------------------------
-- Anonymous voucher redemptions have no guest_id — capture the buyer
-- name at redemption time so the booking is still identifiable.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_name_snapshot TEXT;

-- 6. Atomic redemption RPC -------------------------------------

CREATE OR REPLACE FUNCTION public.redeem_stay_voucher_transaction(
  p_code       TEXT,
  p_listing_id UUID,
  p_caller_id  UUID,
  p_check_in   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code       RECORD;
  v_batch      RECORD;
  v_purchase   RECORD;
  v_listing    RECORD;
  v_booking_id UUID;
BEGIN
  -- Lock the code row to prevent double-redemption races.
  SELECT * INTO v_code
    FROM public.stay_voucher_codes
    WHERE code = p_code
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher code not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_batch
    FROM public.stay_voucher_batches
    WHERE id = v_code.batch_id;
  IF v_batch.listing_id <> p_listing_id THEN
    RAISE EXCEPTION 'This voucher is for a different property.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF v_listing.host_id <> p_caller_id THEN
    RAISE EXCEPTION 'You do not host this listing.' USING ERRCODE = 'P0001';
  END IF;

  IF v_code.status = 'claimed' THEN
    RAISE EXCEPTION 'Voucher already redeemed.' USING ERRCODE = 'P0001';
  END IF;
  IF v_code.status = 'expired' OR v_code.valid_until < now() THEN
    RAISE EXCEPTION 'Voucher expired.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_purchase
    FROM public.stay_voucher_purchases
    WHERE id = v_code.purchase_id;

  INSERT INTO public.bookings (
    listing_id, guest_id, host_id, check_in, check_out,
    nights, guests, total_php, status, payment_status,
    stay_type, booking_flow, booking_mode,
    guest_name_snapshot, paid_at
  ) VALUES (
    p_listing_id, NULL, v_listing.host_id, p_check_in, p_check_in + v_batch.nights,
    v_batch.nights, 1, v_batch.price_php, 'confirmed', 'paid',
    'voucher', 'voucher', 'voucher',
    v_purchase.buyer_name, v_purchase.paid_at
  )
  RETURNING id INTO v_booking_id;

  UPDATE public.stay_voucher_codes
     SET status = 'claimed',
         booking_id = v_booking_id,
         redeemed_by_host_id = p_caller_id,
         redeemed_at = now()
   WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'batch_id', v_batch.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_stay_voucher_transaction(TEXT,UUID,UUID,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_stay_voucher_transaction(TEXT,UUID,UUID,DATE) TO service_role;

-- 7. Expiry sweep function + cron ------------------------------

CREATE OR REPLACE FUNCTION public.expire_stay_vouchers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.stay_voucher_codes c
       SET status = 'expired'
      FROM public.stay_voucher_batches b
     WHERE c.batch_id = b.id
       AND c.status = 'unclaimed'
       AND c.valid_until < now()
    RETURNING c.id, b.price_php
  ),
  revenue AS (
    INSERT INTO public.platform_revenue_events (source, amount_php, stay_voucher_code_id)
    SELECT 'voucher_expired', price_php, id FROM expired
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM revenue;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stay_vouchers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stay_vouchers() TO service_role;

-- Schedule via pg_cron. Guard against the extension not being installed
-- in local dev by checking pg_extension.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cheapstays-stay-voucher-expiry',
      '0 */6 * * *',
      $sql$ SELECT public.expire_stay_vouchers(); $sql$
    );
  END IF;
END $$;
