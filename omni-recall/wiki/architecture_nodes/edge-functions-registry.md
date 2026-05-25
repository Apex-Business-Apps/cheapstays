# Architecture: Edge Functions Registry

- project: cheapstays
- source: CLAUDE.md §4
- verified: 2026-05-23

## All Functions

| Function | Auth | Purpose | Key Constraint |
|----------|------|---------|----------------|
| `approve-host-via-ticket` | admin | Approve host via support ticket | ticket_id only; user_id server-side |
| `approve-host-application` | admin | Approve KYC form application | requires id_front_path + selfie_path |
| `grant-host-role` | admin | ⛔ DEPRECATED | blocks self-grant; do not call |
| `admin-role-mutation` | admin | Grant/revoke any role | writes to immutable role_mutation_audit |
| `book-listing` | user | Create booking | validates dates, min_nights, max_guests |
| `booking-checkout` | user | Create PayMongo checkout | rate limit: 5/60s |
| `payment-intent` | user | Create payment intent | dual-provider; Stripe gated |
| `support-ticket` | user | Create support ticket | auto-escalates on urgent/extreme keywords |
| `support-message` | user | Post message to ticket | requires author_user_id = auth.uid() |
| `ai-chat` | user | Streaming Groq chat — frontend brand name: **Pip** | rate limit: 40/60s; guardrail-checked |
| `ai-search` | - | AI listing search | returns ≤6 ranked results |
| `ai-describe` | - | AI listing description | tone: confident/playful/minimal |
| `membership-webhook` | none (sig) | PayMongo membership events | idempotent via webhook_events |
| `payment-webhook` | none (sig) | PayMongo payment events | idempotent via webhook_events |
| `stripe-webhook` | none (sig) | Stripe events | disabled unless ENABLE_UNAPPROVED_PROVIDERS=true |
| `send-push-notification` | service_role | Web push dispatch | cleans up 404/410 subscriptions |
| `send-email-notification` | service_role | Email via Resend | graceful no-op if RESEND_API_KEY missing |
| `agoda-search` | none | Agoda affiliate proxy | top 9 PH properties |
| `assign-member-role` | user | Self-serve member role | only `member` role allowed |
| `membership-payment-intent` | user | PayMongo ₱249/month checkout | PayMongo only (not dual-provider) |
| `omnihub-role-authority` | - | OmniHub registry commands | via execute_role_mutation RPC |

## Shared Utilities (`_shared/`)

All functions must:
1. Return `corsHeaders` on OPTIONS
2. Validate body with Zod
3. `await rateLimit(key, max, windowMs)` — never omit the `await`

## Related Pages

- [[stack]] (architecture_nodes)
- [[two-path-host-verification]] (concepts)
- [[cheapstays]] (projects)
