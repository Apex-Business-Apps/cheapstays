ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paymongo_idempotency_key TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paymongo_payment_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_ref TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ GENERATED ALWAYS AS (created_at + INTERVAL '2 hours') STORED;

CREATE INDEX IF NOT EXISTS idx_bookings_expiry ON bookings(payment_status, expires_at) WHERE payment_status='pending';

CREATE OR REPLACE FUNCTION expire_pending_bookings() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings SET payment_status='expired', updated_at=now()
  WHERE payment_status='pending' AND created_at < now() - INTERVAL '2 hours';
END;
$$;

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  event_type TEXT NOT NULL,
  paymongo_ref TEXT,
  amount_centavos INTEGER,
  actor_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_audit_booking_id ON payment_audit_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_created_at ON payment_audit_log(created_at);
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION process_paymongo_paid_webhook(
  p_booking_id UUID,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payment_id TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings SET payment_status='paid', paid_at=now(), paymongo_payment_id=COALESCE(p_payment_id, paymongo_payment_id), updated_at=now() WHERE id=p_booking_id;
  INSERT INTO webhook_events(provider,event_id,event_type,booking_id,processed_at)
  VALUES ('paymongo',p_event_id,p_event_type,p_booking_id,now());
END;
$$;
