-- Add 'stripe' to payment_provider enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider' AND e.enumlabel = 'stripe'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'stripe';
  END IF;
END $$;

-- Add stripe_payment_intent_id column
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_pi
  ON public.bookings (stripe_payment_intent_id);