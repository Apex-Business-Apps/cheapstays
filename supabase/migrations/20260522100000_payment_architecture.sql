DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('paymongo', 'stripe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_state AS ENUM (
    'intent_created','authorized','captured','refunding','refunded','payout_on_hold','payout_released','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider,
  ADD COLUMN IF NOT EXISTS payment_state public.payment_state,
  ADD COLUMN IF NOT EXISTS refundable_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_release_on TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS incidental_hold_required BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.incidental_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  guest_response TEXT,
  subjective_case BOOLEAN NOT NULL DEFAULT false,
  manual_gate_approved BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','guest_responded','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payout_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  hold_until TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
