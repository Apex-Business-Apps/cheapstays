# PayMongo Webhook Setup (CheapStays)

## Deploy function

Since the functions are configured in `supabase/config.toml` with `verify_jwt = false`, no manual `--no-verify-jwt` CLI flag is required. Deploy them directly:

```bash
supabase functions deploy paymongo-webhook
supabase functions deploy membership-webhook
```

## Required Supabase secrets

```bash
supabase secrets set PAYMONGO_SECRET_KEY="..."
supabase secrets set PAYMONGO_WEBHOOK_SECRET="..."
supabase secrets set SITE_URL="https://cheapstays.me"
```

## Webhook endpoint URL (PayMongo dashboard)

`https://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1/paymongo-webhook`

## PayMongo dashboard events to select

Required:
- `checkout_session.payment.paid`

Optional (only if later implemented in function behavior):
- `payment.failed`
- `payment.refunded`
- `payment.refund.updated`

## Warning

Do **not** select Link, QRPh, Source, Subscription, Account, or Linked Account Onboarding events for the current CheapStays checkout flow.

## Notes

- The function validates the PayMongo signature from the `paymongo-signature` header before parsing JSON.
- Duplicate webhook events are safely ignored through `public.webhook_events` (`provider + event_id` uniqueness).
