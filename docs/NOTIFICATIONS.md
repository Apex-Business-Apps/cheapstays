# Notifications

## Table: `notifications`

Migration: `supabase/migrations/20260521260000_notifications.sql`

| Column       | Type        | Notes                              |
|--------------|-------------|------------------------------------|
| `id`         | UUID PK     | `gen_random_uuid()`                |
| `user_id`    | UUID FK     | References `auth.users`, cascades  |
| `type`       | TEXT        | e.g. `booking_status`              |
| `title`      | TEXT        | Short notification title           |
| `body`       | TEXT        | Full notification text             |
| `data`       | JSONB       | Arbitrary payload (default `{}`)   |
| `read`       | BOOLEAN     | Default `false`                    |
| `created_at` | TIMESTAMPTZ | Default `NOW()`                    |

Index on `(user_id, created_at DESC)` for efficient per-user queries.

## Row Level Security

- **Users see own notifications**: SELECT filtered by `auth.uid() = user_id`.
- **Service role manages notifications**: Full access for server-side writes.

## Booking Status Trigger

`notify_booking_status()` fires `AFTER UPDATE OF status ON bookings`. When `NEW.status != OLD.status`, it inserts a notification for `guest_id` with a human-readable title and a JSONB payload containing `booking_id` and `status`.

Status → title mapping:
- `confirmed` → "Booking Confirmed!"
- `cancelled` → "Booking Cancelled"
- `completed` → "Stay Completed"
- other → "Booking Update"

## Future Push Provider Abstraction

The `notifications` table is provider-agnostic. To add real-time push:

1. Add a `push_subscriptions` table (endpoint, keys) linked to `user_id`.
2. Create a Supabase Edge Function that listens to `notifications` inserts via pg_notify or a webhook and calls the Web Push API (VAPID) or a provider like Firebase FCM.
3. Front-end: register a service worker, subscribe via `PushManager.subscribe()`, and store the subscription in `push_subscriptions`.

In-app notification badge can be implemented with a Supabase Realtime subscription on the `notifications` table filtered by `user_id`.
