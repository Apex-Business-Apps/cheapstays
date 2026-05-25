# Notifications

## Channels

- Email
- In-app
- Push (high-value events only)

Official contact mailbox: `cheapstays.me@gmail.com`.

## Preferences

Migration: `supabase/migrations/20260522090000_notification_preferences_and_support_routing.sql`

`notification_preferences` stores per-user toggles by channel and event family:

- booking
- payment
- verification
- host status
- check-in
- refund
- payout
- support
- evidence
- dispute
- safety critical

Default policy: email + in-app enabled, push enabled but used only for high-value events.

## Templates

`notification_templates` is a source-of-truth catalog for default copy and delivery strategy.

Templates included:

- booking_status_changed
- payment_failed
- verification_required
- host_status_approved
- check_in_access_shared
- refund_processed
- payout_released
- support_ticket_updated
- evidence_requested
- dispute_status_changed
- safety_admin_action

## Push policy (anti-spam)

Push should be sent only for high-value events:

- booking changes
- payment failures
- check-in access
- host approval
- support escalation
- urgent safety/admin action

All other events should default to in-app (and optionally email based on preferences).

## Support routing categories

Support tickets are normalized to:

- booking
- payment_refund
- host_verification
- property_condition
- incidentals_damage
- safety_privacy_surveillance
- account_access
- technical_bug

Escalation policy: only subjective/extreme outliers route directly to manual/admin review.
