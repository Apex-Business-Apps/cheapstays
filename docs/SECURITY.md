# Security Policy

**Organization:** APEX Business Systems Ltd.
**Location:** Edmonton, AB
**Document Version:** 1.0.0
**Classification:** Internal — Engineering & Operations
**Last Updated:** 2026-05-21
**Next Review:** 2026-08-21

---

## 1. Overview

CheapStays employs a defense-in-depth security model across five distinct layers:

1. **Cloudflare Edge** — CDN-level DDoS mitigation, TLS termination, and geographic traffic filtering
2. **Supabase JWT Authentication** — All API requests validated against short-lived JWT tokens issued by Supabase Auth
3. **Role-Based Access Control (RBAC)** — Four application roles with enforced privilege boundaries
4. **Row-Level Security (RLS)** — PostgreSQL-native, per-row access control enforced at the database engine level
5. **Edge Function Rate Limits & Input Validation** — Per-function Zod schema validation and IP/user-scoped rate limiting on every Supabase Edge Function endpoint

No single layer is trusted in isolation. A breach of one layer does not grant access to platform data.

---

## 2. Authentication & Identity

**Provider:** Supabase Auth

**Supported methods:**
- Email + magic-link (passwordless)
- OAuth-ready (provider configuration via Supabase dashboard)

**Token model:**
- JWT tokens are short-lived (Supabase default expiry applies)
- Tokens are validated on every authenticated request via `supabaseUser.auth.getUser()`
- Refresh tokens are managed by the Supabase client library

**API key classification:**

| Key | Scope | Safe in Client Code? | Storage |
|---|---|---|---|
| `SUPABASE_ANON_KEY` | Read-only; subject to RLS | Yes — safe to bundle in client | `VITE_SUPABASE_ANON_KEY` build variable |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-level; bypasses RLS | **Never** | Supabase edge function secrets vault only |

**Session storage:**
- Default: Supabase's `localStorage`-based session (acceptable for SPA deployments)
- Can be switched to `httpOnly` cookie-based sessions via Supabase SSR adapter if stricter session isolation is required

---

## 3. Role-Based Access Control (RBAC)

**Defined roles** (`public.app_role` ENUM):

| Role | Description |
|---|---|
| `user` | Default role assigned to every new account on signup |
| `host` | Verified property owner; required to create and manage listings |
| `member` | Paid subscriber with access to member-only features |
| `admin` | Full platform access; can manage all data and assign roles |

**Role assignment:**
- Only users with the `admin` role can INSERT or DELETE rows in `user_roles`
- This is enforced by RLS policies — not application logic — and cannot be bypassed by the client
- The `has_role()` function (SECURITY DEFINER) is called inside all sensitive RLS policies to prevent privilege escalation

**Role audit log:**
- Every `INSERT` or `DELETE` on `user_roles` fires the `trg_role_audit` trigger
- The trigger calls `log_role_change()` (SECURITY DEFINER), which inserts a record into `role_audit_log` with:
  - `target_user_id` — the user whose role changed
  - `role` — the affected role
  - `action` — `'granted'` or `'revoked'`
  - `actor_user_id` — the admin who performed the action
  - `created_at` — UTC timestamp

**`has_role()` function:**
```sql
has_role(_user_id UUID, _role public.app_role) RETURNS BOOLEAN
-- SECURITY DEFINER, STABLE, search_path = public
```
Called in RLS policies across all sensitive tables. Runs with elevated privilege to query `user_roles` without triggering recursive RLS evaluation.

---

## 4. Row Level Security (RLS)

RLS is enabled on every table in the `public` schema. All policies are enforced at the PostgreSQL engine level and cannot be overridden by application code using the anon or authenticated keys.

### Policy Summary

| Table | Anon Read | Auth Read | Insert | Update | Delete |
|---|---|---|---|---|---|
| `profiles` | ✗ | All authenticated users (own + others) | Own only (`auth.uid() = user_id`) | Own only | — |
| `user_roles` | ✗ | Own only (or admin) | Admin only | — | Admin only |
| `role_audit_log` | ✗ | Admin only | System trigger (`log_role_change`) | — | — |
| `support_tickets` | ✗ | Own + admin | Own only | Owner + admin | — |
| `support_messages` | ✗ | Ticket owner + admin | Ticket owner (sender=user) / admin (sender=admin) | — | — |
| `host_profiles` | Verified only | Own + verified (via anon policy) | Own only (authenticated) | Own + admin | — |
| `listings` | Active only (anon `SELECT` grant) | Active + own + admin | Authenticated with `host` role, own `host_id` | Own + admin | Own + admin |
| `bookings` | ✗ | Guest + host + admin | Own `guest_id` (authenticated) | Guest (pending status) + host + admin | — |
| `reviews` | `is_public = true` | Own + admin | Own `reviewer_id`, completed booking | Own + admin | Own + admin |
| `concierge_requests` | ✗ | Own + admin | Own only | Own + admin | — |

**Notes:**
- The `anon` role is granted `SELECT` only on `listings`, `host_profiles`, and `reviews` via explicit `GRANT` statements. All other tables are inaccessible to unauthenticated connections.
- The `profiles` table allows all authenticated users to read all profiles (used for displaying host/guest names in the UI). Sensitive fields such as email are not stored in `profiles`.

---

## 5. Edge Function Security

All Supabase Edge Functions (Deno runtime) implement the following security controls uniformly:

- **CORS:** `Access-Control-Allow-Origin: *` with allowed headers `authorization, x-client-info, apikey, content-type`. OPTIONS pre-flight requests are handled and return `200 ok` before any processing.
- **Input validation:** Every request body is parsed through a Zod schema using `safeParse()`. Invalid or missing fields return HTTP `400` with a structured error payload. Processing does not begin until validation passes.
- **Rate limiting:** In-memory sliding-window rate limiter applied per IP (unauthenticated endpoints) or per user ID (authenticated endpoints).

### Rate Limit Table

| Function | Limit | Window | Key |
|---|---|---|---|
| `ai-chat` | 40 req/min | 60 s | Per IP |
| `ai-describe` | 15 req/min | 60 s | Per IP |
| `ai-search` | 20 req/min | 60 s | Per IP |
| `book-listing` | 10 req/min | 60 s | Per IP (JWT required) |
| `payment-intent` | 5 req/min | 60 s | Per IP (JWT required) |
| `support-ticket` | 10 req/min | 60 s | Per user ID (JWT required) |
| `support-message` | 30 req/min | 60 s | Per user ID (JWT required) |
| `support-stream` | 20 req/min | 60 s | Per user ID (JWT required) |

**Authentication enforcement on protected functions:**
Functions that require authentication (`book-listing`, `payment-intent`, `support-ticket`, `support-message`, `support-stream`) verify the caller's JWT by constructing a Supabase user client with the `Authorization` header and calling `auth.getUser()`. A missing or invalid token returns HTTP `401` before any business logic executes.

---

## 6. Payment Security

**Payment processor:** PayMongo (PCI-compliant; Philippines-based)

**Key security properties:**

- CheapStays does **not** store, log, or transmit full card numbers, CVV, or raw payment credentials
- Only `paymongo_payment_intent_id` is persisted in the `bookings` table as a reference token
- Payment amounts are calculated exclusively server-side in the `book-listing` edge function using `nightly_php` from the database; the client cannot provide or override the total
- All payment operations require a valid JWT — unauthenticated requests are rejected at the function entry point
- `PAYMONGO_SECRET_KEY` is stored exclusively in the Supabase edge function secrets vault and is never exposed in logs, environment variables visible to client bundles, or version control

**PayMongo flow (server-side):**
1. `payment-intent` function fetches booking and listing from DB (server-side amount verification)
2. Creates a PayMongo `payment_intent` with amount in centavos
3. Creates a PayMongo `payment_method` of the requested type
4. Attaches the payment method to the intent
5. Returns `checkout_url` (redirect URL for 3DS or e-wallet authentication) to the client
6. Updates `bookings.paymongo_payment_intent_id` and `payment_status = 'pending'`

**Demo mode:** If `PAYMONGO_SECRET_KEY` is not configured, the function enters demo mode: the booking is confirmed without payment processing, and `demo_mode: true` is returned in the response.

---

## 7. Data Classification

| Classification | Examples | Handling |
|---|---|---|
| **Public** | Active listings, public reviews, city information | Freely returned via anon API; no auth required |
| **Internal** | User profiles, bookings, host profiles | Authenticated access only; subject to RLS |
| **Confidential** | Email addresses, phone numbers, booking details | Auth required; never written to server logs |
| **Secret** | `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `PAYMONGO_SECRET_KEY` | Supabase edge function secrets vault exclusively |

---

## 8. Secret Management

**Storage:** All platform secrets are stored in the Supabase edge function secrets vault. Secrets are injected into the Deno runtime at invocation time via `Deno.env.get()` and are never accessible to the client.

**Secrets inventory:**

| Secret | Used By | Notes |
|---|---|---|
| `GROQ_API_KEY` | `ai-chat`, `ai-describe`, `ai-search`, `support-ticket`, `support-message`, `support-stream` | LLM inference |
| `PAYMONGO_SECRET_KEY` | `payment-intent` | Philippine payment processor |
| `SUPABASE_SERVICE_ROLE_KEY` | All edge functions requiring admin DB access | Auto-injected by Supabase runtime |

**Cloudflare Pages build variables:**
- Only `VITE_` prefixed public variables are permitted in Cloudflare Pages build configuration
- Currently in use: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- These are safe to expose; neither grants any elevated privilege

**Rotation schedule:**
- Service role key: rotate every **90 days** or immediately on any suspected exposure
- Payment secret key: rotate **immediately** on any suspected exposure
- Groq API key: rotate every **90 days** or on suspected exposure

**Version control policy:**
- The service role key is **never committed to git**
- The anon key (public) may appear in client-side code and build configurations
- A `.env` file containing secrets must never be committed; `.env` is listed in `.gitignore`

---

## 9. Input Validation & Injection Prevention

**Zod schema validation:**
Every edge function parses incoming request bodies through a Zod schema via `safeParse()`. Processing halts with HTTP `400` if validation fails. This eliminates type confusion, unexpected nulls, and oversized payloads before they reach business logic.

**SQL injection:**
All database queries use the Supabase JavaScript client's parameterized query builder. There is no raw string interpolation in `WHERE` clauses or query construction. The Supabase client library handles escaping.

**XSS prevention:**
The React SPA uses JSX, which escapes all dynamic content by default. There is no use of `dangerouslySetInnerHTML` in the codebase.

**Prompt injection:**
- User-supplied content passed to the Groq LLM is capped at 2,000–4,000 characters per field (enforced by Zod schemas)
- System prompts are defined as constants in edge function source code and are clearly separated from user content in the messages array
- The LLM is not given tools or function-calling capability that could affect application state

**Escalation keyword detection:**
The `support-ticket` function scans submitted subject and message text for escalation keywords (`refund`, `fraud`, `chargeback`, `scam`, `legal`, `lawsuit`, `stolen`, `urgent`). Matched tickets bypass AI handling and are immediately flagged for human review.

---

## 10. Vulnerability Reporting

**Security contact:** security@apexbusinesssystems.ca

**Responsible disclosure policy:**
- Researchers are granted a **90-day disclosure window** from the date of initial report
- We ask that you do not publicly disclose the vulnerability until the window has elapsed or a fix has been released, whichever comes first

**Severity response targets:**
- **Critical** (data exfiltration, auth bypass, payment manipulation): notify within **24 hours** via direct email; do not post in public issue trackers or forums
- **High** (privilege escalation, RLS bypass): notify within **72 hours** via direct email
- **Medium / Low**: standard responsible disclosure via security@apexbusinesssystems.ca

We commit to acknowledging all reports within 2 business days and providing a remediation timeline within 7 business days.
