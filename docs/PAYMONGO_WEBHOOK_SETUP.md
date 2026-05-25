# PayMongo Webhook Setup (CheapStays)

## Deploy function

```bash
supabase functions deploy paymongo-webhook --no-verify-jwt
```

## Required Supabase secrets

```bash
supabase secrets set PAYMONGO_WEBHOOK_SECRET="..."
supabase secrets set SUPABASE_URL="..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
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
