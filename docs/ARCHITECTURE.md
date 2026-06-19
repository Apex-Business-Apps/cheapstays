# System Architecture

**Organization:** JGP Corporation
**Location:** Pasig City, Metro Manila, Philippines
**Document Version:** 1.2.1
**Last Updated:** 2026-05-25

---

## 1. Overview

CheapStays is a single-page application (SPA) built with Vite, React, and TypeScript, backed by Supabase as a Backend-as-a-Service (BaaS) and delivered globally via Cloudflare Pages CDN. The platform serves the Philippine short-term rental market, connecting guests with owner-direct properties.

The architecture separates concerns across three tiers:

1. **Presentation tier** — React SPA served as static assets from Cloudflare's edge network
2. **API and auth tier** — Supabase Edge Functions (Deno runtime) and Supabase Auth (JWT-based)
3. **Data tier** — PostgreSQL 17 (Supabase-managed) with Row-Level Security enforced at the engine level

---

## 2. Component Map

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages (CDN)                                  │
│  cheapstays.me · www.cheapstays.me                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  React SPA (Vite + TypeScript)                      │ │
│  │  react-router-dom · react-i18next · framer-motion   │ │
│  │  shadcn/ui · Tailwind CSS                           │ │
│  └────────────────┬───────────────────────────────────┘ │
└───────────────────│─────────────────────────────────────┘
                    │ HTTPS
         ┌──────────▼──────────────────────────┐
         │  Supabase (muqdmvkapsxrsgdkfoxn)      │
         │  ┌──────────────────────────────────┐│
         │  │  Supabase Auth (JWT)             ││
         │  ├──────────────────────────────────┤│
         │  │  PostgreSQL + RLS                ││
         │  │  Tables: profiles, user_roles,   ││
         │  │  listings, bookings, reviews,    ││
         │  │  host_profiles, support_tickets  ││
         │  ├──────────────────────────────────┤│
         │  │  Edge Functions (Deno)           ││
         │  │  ai-chat · ai-search · ai-describe ││
         │  │  book-listing · payment-intent   ││
         │  │  paymongo-webhook                ││
         │  │  support-ticket · support-message ││
         │  │  omnihub-role-authority           ││
         │  └─────────────┬────────────────────┘│
         └────────────────│────────────────────┘
                          │
            ┌─────────────┼──────────┐
            ▼             ▼          ▼
         Groq API     PayMongo    Supabase
         (LLM)        (Payments)  (DB/Auth)
```

---

## 3. Data Flow: AI Search

1. User enters a natural-language search query in the client
2. Client POSTs to the `ai-search` edge function with the query string and optional filters (`maxNightly`, `minNights`, `city`)
3. The function queries the `listings` table via the service role client (RLS enforces `status = 'active'`); up to 20 listings are fetched
4. Listing data and the user query are passed to Groq (`llama-3.3-70b-versatile`) with a scoring prompt
5. Groq returns a structured JSON response: `summary` + `results[]` with each result scored 0–100 for value and fit
6. The function validates the JSON parse and returns the scored results to the client

---

## 4. Data Flow: Booking

1. User selects dates and guests on a listing page; client validates date order and guest count locally
2. Client POSTs to `book-listing` (JWT Bearer required):
   - Function authenticates the JWT via `supabaseUser.auth.getUser()`
   - Fetches listing from DB (server-side); validates `status = 'active'`, guest count, and minimum nights
   - Runs an overlap conflict query against existing non-cancelled bookings
   - Calculates `total_php = nights × nightly_php` server-side (client cannot supply the total)
   - Inserts booking with `status = 'confirmed'` (instant book) or `status = 'pending'` (host approval required)
   - Returns `booking_id`, `total_php`, and `status`
3. Client POSTs `booking_id` and `payment_method` to `payment-intent` (JWT Bearer required):
   - Function verifies booking belongs to the authenticated user and is in a payable state
   - Creates a PayMongo `payment_intent` (amount in centavos, currency PHP)
   - Creates and attaches a `payment_method` of the requested type
   - Returns `checkout_url` for 3DS or e-wallet redirect
   - Updates `bookings.paymongo_payment_intent_id` and `payment_status = 'pending'`
4. On payment completion: PayMongo calls `paymongo-webhook`, signature is verified against `paymongo-signature`, event idempotency is enforced through `webhook_events`, and booking is updated to `payment_status = 'paid'` + `payment_state = 'captured'` for `checkout_session.payment.paid`.

---

## 5. Data Flow: Host Onboarding

1. User navigates to the host registration flow and submits the host profile form
2. Client upserts `host_profiles` row with `verification_status = 'unverified'` (or `'pending'` after submitting ID documents)
3. Admin reviews the submission in the admin dashboard
4. Admin grants the `host` role via the `user_roles` table (INSERT restricted to admins by RLS)
5. The `trg_role_audit` trigger logs the grant to `role_audit_log`
6. The user now satisfies `has_role(auth.uid(), 'host')` — the RLS policy on `listings` allows INSERTs

---

## 6. Data Flow: Support Tickets

1. Authenticated user submits a support ticket via `POST /support-ticket`
2. The function auto-detects escalation keywords in the subject and message (e.g., `refund`, `fraud`, `legal`)
3. If escalated: ticket inserted with `status = 'escalated'`; AI response is skipped; flagged for human review
4. If not escalated: ticket inserted with `status = 'open'`; Groq generates an AI first-response (2–4 paragraphs); ticket updated to `status = 'pending'`
5. User can add follow-up messages via `POST /support-message`; AI responds unless ticket is escalated
6. `POST /support-stream` streams a real-time AI response via Server-Sent Events (SSE) using Groq's streaming API

---

## 7. Internationalization (i18n)

- **Supported languages (9):** English (`en`), Filipino (`fil`), Chinese Simplified (`zh`), Malay (`ms`), Indonesian (`id`), Korean (`ko`), Vietnamese (`vi`), Japanese (`ja`), Thai (`th`)
- **Detection order:** `localStorage` → browser language header → English fallback
- **Implementation:** `react-i18next`; translation JSON files located in `src/i18n/locales/`
- **Voice assistant (Pip):** Local regex matching handles navigation commands and language switching without an LLM round-trip; unresolved utterances are forwarded to the `ai-chat` edge function

---

## 8. Tech Stack

| Component | Technology | Version |
|---|---|---|
| Build tool | Vite | 5.x |
| UI framework | React | 18.x |
| Language | TypeScript | 5.x |
| Routing | react-router-dom | 6.x |
| Internationalization | react-i18next | 15.x |
| UI components | shadcn/ui + Radix UI | Latest |
| Styling | Tailwind CSS | 3.x |
| Animation | Framer Motion | 11.x |
| Backend / BaaS | Supabase | 2.x |
| Edge runtime | Deno | 1.x (Supabase-managed) |
| AI / LLM | Groq API (`llama-3.3-70b-versatile`) | — |
| Payment processing | PayMongo | v1 |
| CDN / Hosting | Cloudflare Pages | — |
| Input validation | Zod | 3.x |

---

## 9. Environment Variables

| Variable | Location | Visibility | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Cloudflare Pages build | Public | Supabase project REST endpoint |
| `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages build | Public | Supabase anon key (read-only, RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets vault | Secret — server only | Admin DB access in edge functions |
| `GROQ_API_KEY` | Supabase secrets vault | Secret — server only | LLM inference via Groq |
| `PAYMONGO_SECRET_KEY` | Supabase secrets vault | Secret — server only | PayMongo payment processing |
| `PAYMONGO_WEBHOOK_SECRET` | Supabase secrets vault | Secret — server only | Verify PayMongo webhook signatures |

All secrets are injected into the Deno runtime at invocation time via `Deno.env.get()` and are never accessible to the client or written to logs.


## 10. Omniport / Audit Event Emission

- Role and authority workflows emit audit events through `supabase/functions/_shared/omniport.ts`.
- Current emitters: `admin-role-mutation` and `omnihub-role-authority`.
- Required secrets for emission: `OMNIPORT_BASE_URL` and `OMNIPORT_TOKEN`; emit is skipped safely when absent.
- **Repo-state clarification:** Omniport audit forwarding is implemented in edge functions, while governance/operating guidance is maintained under the repository `omni-recall/` tree on `main`.
