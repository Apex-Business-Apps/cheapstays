-- Notification preferences + routing policy to keep alerts useful (not noisy)

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  booking_updates BOOLEAN NOT NULL DEFAULT true,
  payment_updates BOOLEAN NOT NULL DEFAULT true,
  verification_updates BOOLEAN NOT NULL DEFAULT true,
  host_status_updates BOOLEAN NOT NULL DEFAULT true,
  check_in_updates BOOLEAN NOT NULL DEFAULT true,
  refund_updates BOOLEAN NOT NULL DEFAULT true,
  payout_updates BOOLEAN NOT NULL DEFAULT true,
  support_updates BOOLEAN NOT NULL DEFAULT true,
  evidence_updates BOOLEAN NOT NULL DEFAULT true,
  dispute_updates BOOLEAN NOT NULL DEFAULT true,
  safety_critical_updates BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'booking','payment','verification','host_status','check_in','refund','payout','support','evidence','dispute','safety_critical'
  )),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  default_email BOOLEAN NOT NULL DEFAULT true,
  default_in_app BOOLEAN NOT NULL DEFAULT true,
  default_push BOOLEAN NOT NULL DEFAULT false,
  push_high_value_only BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_templates (key, category, title_template, body_template, default_push) VALUES
('booking_status_changed', 'booking', 'Booking updated', 'Your booking details changed. Review itinerary and latest status.', true),
('payment_failed', 'payment', 'Payment failed', 'Your payment did not complete. Update payment method to avoid cancellation.', true),
('verification_required', 'verification', 'Verification required', 'Please complete verification to continue hosting or booking smoothly.', false),
('host_status_approved', 'host_status', 'Host approved', 'Your host profile is approved. You can now publish and accept bookings.', true),
('check_in_access_shared', 'check_in', 'Check-in access ready', 'Access details are available. Review check-in instructions before arrival.', true),
('refund_processed', 'refund', 'Refund update', 'Your refund status has changed. Check your wallet or payment timeline.', false),
('payout_released', 'payout', 'Payout sent', 'Your payout has been released and is now processing with the provider.', false),
('support_ticket_updated', 'support', 'Support update', 'There is a new message on your support ticket.', true),
('evidence_requested', 'evidence', 'Evidence requested', 'Please upload evidence to keep your case moving.', false),
('dispute_status_changed', 'dispute', 'Dispute update', 'Your dispute status changed. Review the latest decision notes.', false),
('safety_admin_action', 'safety_critical', 'Urgent safety action', 'Immediate action required due to a safety/admin event.', true)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  default_push = EXCLUDED.default_push,
  updated_at = NOW();

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON notification_preferences;
CREATE POLICY "Users manage own notification preferences"
ON notification_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can read templates" ON notification_templates;
CREATE POLICY "Authenticated users can read templates"
ON notification_templates FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Service role manages templates" ON notification_templates;
CREATE POLICY "Service role manages templates"
ON notification_templates FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages preferences" ON notification_preferences;
CREATE POLICY "Service role manages preferences"
ON notification_preferences FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
