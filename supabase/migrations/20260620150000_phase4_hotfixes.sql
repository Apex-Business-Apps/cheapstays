-- ============================================================
-- Phase 4 Hotfixes
-- ============================================================

-- Backfill any existing NULL durations to 12
UPDATE public.vouchers SET duration_hours = 12 WHERE duration_hours IS NULL;

-- Make duration_hours constraint strict
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_duration_hours_check;
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_duration_hours_check1; -- Just in case the previous migration created a named constraint

-- The old constraint didn't have a name explicit in ADD COLUMN, so it might be named vouchers_duration_hours_check
-- We will enforce it via a named constraint now.
ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_duration_hours_check CHECK (duration_hours IN (3, 6, 12));

-- Hardened RPC
CREATE OR REPLACE FUNCTION public.redeem_voucher_transaction(
  p_voucher_id UUID,
  p_caller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voucher RECORD;
  v_booking_id UUID;
  v_listing RECORD;
BEGIN
  -- 1. Fetch voucher with explicit row lock to prevent race conditions
  SELECT * INTO v_voucher FROM public.vouchers WHERE id = p_voucher_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher not found';
  END IF;

  -- 2. Verify caller is host
  SELECT * INTO v_listing FROM public.listings WHERE id = v_voucher.listing_id;
  IF NOT FOUND OR v_listing.host_id != p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not the host of this listing';
  END IF;

  -- 3. Idempotency check: if already redeemed, return existing booking
  IF v_voucher.status = 'redeemed' THEN
    IF v_voucher.booking_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'booking_id', v_voucher.booking_id, 'message', 'Voucher already redeemed');
    ELSE
      RAISE EXCEPTION 'Voucher is redeemed but missing booking_id';
    END IF;
  END IF;

  -- 4. Status validation
  IF v_voucher.status != 'active' THEN
    RAISE EXCEPTION 'Voucher is not active (current status: %)', v_voucher.status;
  END IF;

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    RAISE EXCEPTION 'Voucher is expired';
  END IF;

  IF v_voucher.duration_hours IS NULL THEN
    RAISE EXCEPTION 'Voucher duration_hours must be explicitly set';
  END IF;

  -- 5. Create completed booking
  INSERT INTO public.bookings (
    listing_id,
    guest_id,
    host_id,
    check_in,
    check_out,
    starts_at,
    ends_at,
    nights,
    guests,
    total_php,
    status,
    booking_flow,
    stay_type,
    booking_mode
  ) VALUES (
    v_voucher.listing_id,
    v_voucher.guest_id,
    v_listing.host_id,
    CURRENT_DATE,
    CURRENT_DATE + interval '1 day',
    now(),
    now() + (v_voucher.duration_hours * interval '1 hour'),
    1, 
    1, 
    v_voucher.amount_paid,
    'completed',
    'voucher',
    'hourly',
    'voucher'
  )
  RETURNING id INTO v_booking_id;

  -- 6. Update voucher
  UPDATE public.vouchers
  SET
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = p_caller_id,
    booking_id = v_booking_id
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id, 'message', 'Voucher redeemed successfully');
END;
$$;
