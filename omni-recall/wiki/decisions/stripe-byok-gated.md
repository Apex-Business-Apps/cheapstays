# Decision: Stripe — BYOK, Gated Behind Feature Flag

- date: 2026-05-23
- source: git log (233a143, c739d96), CLAUDE.md §13
- status: active

## Decision

Stripe is a secondary payment provider, brought via user-owned keys (BYOK). It is disabled by default and requires `ENABLE_UNAPPROVED_PROVIDERS=true` in the environment.

PayMongo is the primary provider (GCash, Maya, card — Philippine-market native).

## Rationale

Stripe was scaffolded early alongside PayMongo (#23, 2026-05-22) but added as BYOK backend (233a143, 2026-05-23) before being properly gated. The flag gate ensures Stripe is never accidentally activated in production without explicit opt-in.

## Implementation Points

- `payment-intent` edge function: dual-provider switch
- `stripe-webhook` edge function: disabled unless flag set
- `membership-payment-intent`: PayMongo only
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` env vars required when flag active
