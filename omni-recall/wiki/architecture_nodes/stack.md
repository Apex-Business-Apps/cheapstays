# Architecture: CheapStays Stack

- project: cheapstays
- source: `CLAUDE.md` repo root
- verified: repo evidence, 2026-05-23

## Edge Functions

All under `supabase/functions/<name>/index.ts`. Shared utilities in `supabase/functions/_shared/`.

Key shared utilities:
- `cors.ts` → `corsHeaders` (always return on OPTIONS)
- `auth.ts` → `getUserFromRequest()` → `{user, supabase, error}`
- `rate-limit.ts` → `rateLimit(id, max, windowMs)` — **must `await`**
- `notify.ts` → `dispatchNotification()` — respects notification_preferences
- `groq.ts` → `groqChat()` — llama-3.3-70b-versatile

## Database

- RLS enforced on all tables
- RBAC via `user_roles` + `has_role(_user_id, _role)` RPC
- Audit trail: `role_mutation_audit` — immutable (no UPDATE/DELETE)
- Webhook idempotency: `webhook_events(provider, event_id)`

## Notification Channels

in-app (always if enabled) → push (VAPID, high-value events) → email (Resend, graceful no-op)

## Payment Architecture

- PayMongo default; Stripe gated behind `ENABLE_UNAPPROVED_PROVIDERS=true` — see [[stripe-byok-gated]] (decisions)
- Refund window: -2d from check-in
- Payout release: +1d from check-in
- Blocked methods: prepaid, gift, anonymous_reloadable
