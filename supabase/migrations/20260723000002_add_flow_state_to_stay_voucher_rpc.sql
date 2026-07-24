-- ============================================================
-- Supplemental fix: add flow_state='active' to the INSERT
-- inside redeem_stay_voucher_transaction.
--
-- The original migration 20260723000000_stay_vouchers.sql omitted
-- flow_state from the bookings INSERT column list. Because the column
-- is NOT NULL with no default, every redemption attempt would fail
-- with a not-null constraint violation. This migration replaces the
-- function with an identical body, adding flow_state = 'active' to
-- match the confirmed-booking backfill value set in
-- 20260524020000_booking_availability_schema.sql.
--
-- DO NOT edit the original migration — migration history must stay intact.
-- ============================================================

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
    flow_state,
    guest_name_snapshot, paid_at
  ) VALUES (
    p_listing_id, NULL, v_listing.host_id, p_check_in, p_check_in + v_batch.nights,
    v_batch.nights, 1, v_batch.price_php, 'confirmed', 'paid',
    'voucher', 'voucher', 'voucher',
    'active',
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
