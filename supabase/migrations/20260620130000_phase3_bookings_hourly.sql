-- ============================================================
-- Phase 3: Bookings Schema for Hourly & Vouchers
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS arrival_time TIME,
  ADD COLUMN IF NOT EXISTS duration_hours SMALLINT CHECK (duration_hours IN (3, 6, 12)),
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_mode TEXT CHECK (booking_mode IN ('instant', 'voucher', 'manual_review'));

-- Maintain legacy invariant: check_out > check_in, but hourly stays 
-- will insert check_out as check_in + 1 day to satisfy the constraint.
-- `starts_at` and `ends_at` become the absolute truth for occupancy.
