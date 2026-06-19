# Edge Function API Reference

**Organization:** JGP Corporation
**Document Version:** 1.2.1
**Last Updated:** 2026-05-25
**Base URL:** `https://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1`

---

## Overview

All edge functions are deployed on the Supabase Deno runtime. The following conventions apply uniformly across all endpoints:

- **Transport:** HTTPS only
- **Content type:** `application/json` for all request and response bodies, except streaming endpoints
- **CORS:** `Access-Control-Allow-Origin: *`; allowed headers: `authorization, x-client-info, apikey, content-type`
- **OPTIONS pre-flight:** All endpoints respond to `OPTIONS` with `200 ok` before processing
- **Input validation:** All request bodies are validated via Zod schemas. Invalid payloads return `400` with a structured error object before any business logic executes
- **Rate limiting:** In-memory sliding-window limiter, keyed by IP (unauthenticated) or user ID (authenticated)
- **Authentication:** Endpoints marked "JWT required" validate the caller's token via `supabaseUser.auth.getUser()`. A missing or invalid token returns `401` before any processing

---

## Error Response Format

All error responses use the following structure:

```json
{
  "error": "Human-readable error message or Zod flatten object"
}
```

Standard HTTP status codes:

| Code | Meaning |
|---|---|
| `400` | Validation failure — request body failed Zod schema |
| `401` | Unauthorized — missing or invalid JWT |
| `404` | Resource not found |
| `409` | Conflict — business rule violation (e.g., dates unavailable, already paid) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `502` | Upstream error (Groq or PayMongo returned a non-2xx response) |

---

## 1. POST /ai-chat

**Description:** Streaming chat with Pip, the CheapStays concierge AI. Returns a plain-text stream as the model generates tokens.

**Authentication:** Not required

**Rate limit:** 40 requests/min per IP

### Request Body

```json
{
  "messages": [
    {
      "role": "user" | "assistant" | "system",
      "content": "<string, 1–4000 chars>"
    }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `messages` | array | Yes | 1–40 items |
| `messages[].role` | enum | Yes | `"user"`, `"assistant"`, or `"system"` |
| `messages[].content` | string | Yes | 1–4,000 characters |

**Notes:**
- The system prompt (Pip's persona) is prepended server-side and cannot be overridden by the client
- Messages are forwarded to Groq `llama-3.3-70b-versatile` with `temperature: 0.7` and `stream: true`

### Response (200)

**Content-Type:** `text/plain; charset=utf-8`

The response body is a streamed plain-text sequence of tokens. There is no JSON envelope. Clients should accumulate the stream and render incrementally.

**Headers:**
```
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
```

### Error Responses

| Status | Condition |
|---|---|
| `400` | `messages` array is empty, exceeds 40 items, or an item fails role/length validation |
| `429` | IP has exceeded 40 requests in the current 60-second window |
| `500` | `GROQ_API_KEY` not configured, or unexpected server error |
| `502` | Groq returned a non-2xx status |

---

## 2. POST /ai-describe

**Description:** Generate a listing description from structured property details. Returns a plain-text description (3–4 paragraphs, no Markdown).

**Authentication:** Not required

**Rate limit:** 15 requests/min per IP

### Request Body

```json
{
  "title": "<string>",
  "bullets": ["<fact 1>", "<fact 2>"],
  "tone": "confident" | "playful" | "minimal"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | Yes | 2–200 characters |
| `bullets` | array of strings | Yes | 1–20 items; each 1–300 characters |
| `tone` | enum | No | `"confident"` (default), `"playful"`, or `"minimal"` |

**Tone behavior:**
- `confident` — Direct, factual, zero hype
- `playful` — Light, warm, a little fun; still honest
- `minimal` — Sparse, declarative sentences; just the facts

### Response (200)

```json
{
  "description": "<plain text, 3-4 paragraphs>"
}
```

| Field | Type | Description |
|---|---|---|
| `description` | string | AI-generated listing description |

### Error Responses

| Status | Condition |
|---|---|
| `400` | `title` or `bullets` fails length/count validation, or `tone` is not a recognized value |
| `429` | IP has exceeded 15 requests in the current 60-second window |
| `500` | `GROQ_API_KEY` not configured, or unexpected server error |

---

## 3. POST /ai-search

**Description:** AI-powered listing search. Queries active listings from the database, then uses Groq to score and rank results by value and fit for the user's query. Returns up to 6 ranked matches.

**Authentication:** Not required

**Rate limit:** 20 requests/min per IP

### Request Body

```json
{
  "query": "<natural language search>",
  "filters": {
    "maxNightly": 2500,
    "minNights": 2,
    "city": "Cebu"
  }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `query` | string | Yes | 2–500 characters |
| `filters` | object | No | All filter fields optional |
| `filters.maxNightly` | number | No | Positive number; filters listings by `nightly_php ≤ value` |
| `filters.minNights` | number | No | Positive integer; filters listings by `min_nights ≥ value` |
| `filters.city` | string | No | Max 120 characters; case-insensitive partial match |

### Response (200)

```json
{
  "summary": "<brief narrative summary>",
  "results": [
    {
      "id": "<uuid>",
      "title": "<listing title>",
      "city": "<city name>",
      "nightly_php": 1200,
      "why_its_a_deal": "<AI explanation>",
      "score": 87,
      "bedrooms": 2,
      "max_guests": 4,
      "amenities": ["WiFi", "AC", "Pool"],
      "avg_rating": 4.8,
      "is_owner_direct": true
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `summary` | string | Narrative overview of the search results |
| `results` | array | Up to 6 scored listings, ordered by score descending |
| `results[].id` | string (UUID) | Listing UUID |
| `results[].title` | string | Listing title |
| `results[].city` | string | City where listing is located |
| `results[].nightly_php` | number | Nightly rate in Philippine pesos |
| `results[].why_its_a_deal` | string | AI explanation of value proposition |
| `results[].score` | number | Value/fit score 0–100 assigned by the AI |
| `results[].bedrooms` | number | Number of bedrooms |
| `results[].max_guests` | number | Maximum guest capacity |
| `results[].amenities` | string[] | List of amenity strings |
| `results[].avg_rating` | number or null | Average star rating (public reviews), or `null` if no reviews |
| `results[].is_owner_direct` | boolean | Whether listing is owner-direct (no agency) |

**Empty result:** If no listings match the database filters, the function returns `{ "summary": "No listings found matching your criteria. Try adjusting your filters.", "results": [] }` without calling Groq.

### Error Responses

| Status | Condition |
|---|---|
| `400` | `query` is missing, too short/long, or filter values fail validation |
| `429` | IP has exceeded 20 requests in the current 60-second window |
| `500` | Database error fetching listings, or unexpected server error |
| `502` | Groq returned invalid JSON or a non-2xx status |

---

## 4. POST /book-listing

**Description:** Create a booking for an active listing. Validates availability, enforces business rules, and inserts a booking record. Payment is handled separately via `/payment-intent`.

**Authentication:** JWT Bearer required

**Rate limit:** 10 requests/min per IP

### Request Headers

```
Authorization: Bearer <supabase_jwt>
```

### Request Body

```json
{
  "listing_id": "<uuid>",
  "check_in": "2026-06-15",
  "check_out": "2026-06-18",
  "guests": 2,
  "guest_message": "We'll arrive around 3pm."
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `listing_id` | string (UUID) | Yes | Must be a valid UUID |
| `check_in` | string | Yes | Format: `YYYY-MM-DD` |
| `check_out` | string | Yes | Format: `YYYY-MM-DD`; must be after `check_in` |
| `guests` | integer | Yes | 1–20; must not exceed listing `max_guests` |
| `guest_message` | string | No | Max 1,000 characters |

**Server-side validations (beyond schema):**
- `check_out` must be strictly after `check_in`
- Listing must exist and have `status = 'active'`
- `guests` must not exceed listing `max_guests`
- `nights` must meet or exceed listing `min_nights`
- No overlapping bookings with `status` not in `('cancelled', 'no_show')`
- `total_php` is calculated server-side: `nights × listing.nightly_php`

### Response (201)

```json
{
  "booking_id": "<uuid>",
  "listing_title": "Beachfront Studio · Boracay",
  "check_in": "2026-06-15",
  "check_out": "2026-06-18",
  "nights": 3,
  "total_php": 8400.00,
  "status": "confirmed" | "pending",
  "message": "<human-readable status message>"
}
```

| Field | Type | Description |
|---|---|---|
| `booking_id` | string (UUID) | Newly created booking ID |
| `listing_title` | string | Title of the booked listing |
| `check_in` | string | Check-in date (`YYYY-MM-DD`) |
| `check_out` | string | Check-out date (`YYYY-MM-DD`) |
| `nights` | integer | Number of nights |
| `total_php` | number | Total amount in Philippine pesos (server-calculated) |
| `status` | string | `"confirmed"` if listing has `instant_book = true`; otherwise `"pending"` |
| `message` | string | User-facing status description |

### Error Responses

| Status | Condition |
|---|---|
| `400` | Schema validation failure; `check_out <= check_in`; too many guests; below minimum nights |
| `401` | Missing or invalid JWT |
| `404` | Listing not found |
| `409` | Listing is not active; requested dates have a conflicting booking |
| `429` | IP has exceeded 10 requests in the current 60-second window |
| `500` | Database error during conflict check or booking insert |

---

## 5. POST /payment-intent

**Description:** Create a PayMongo payment intent for an existing booking. Attaches the payment method to the intent and returns a checkout URL for redirect-based payment flows (3DS, GCash, Maya).

**Authentication:** JWT Bearer required

**Rate limit:** 5 requests/min per IP

### Request Headers

```
Authorization: Bearer <supabase_jwt>
```

### Request Body

```json
{
  "booking_id": "<uuid>",
  "payment_method": "gcash" | "maya" | "card"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `booking_id` | string (UUID) | Yes | Must be a valid UUID; booking must belong to the authenticated user |
| `payment_method` | enum | Yes | `"gcash"`, `"maya"`, or `"card"` |

**Server-side validations:**
- Booking must exist and `guest_id` must match the authenticated user
- Booking `status` must be `"pending"` or `"confirmed"`
- Booking `payment_status` must be `"unpaid"`
- Payment amount is read from `bookings.total_php` (cannot be overridden by the client)

### Response (200) — Live Mode

```json
{
  "payment_intent_id": "pi_xxxxxxxxxxxxxxxxxxxxxxxx",
  "client_key": "pi_xxxxxxx_client_xxxxxxx",
  "next_action": {
    "redirect": {
      "url": "https://checkout.paymongo.com/..."
    }
  },
  "checkout_url": "https://checkout.paymongo.com/..."
}
```

| Field | Type | Description |
|---|---|---|
| `payment_intent_id` | string | PayMongo payment intent ID (stored in `bookings.paymongo_payment_intent_id`) |
| `client_key` | string | PayMongo client key for front-end SDK use |
| `next_action` | object or null | PayMongo `next_action` object; contains redirect URL for 3DS/e-wallet flows |
| `checkout_url` | string or null | Direct redirect URL for payment completion; `null` if not applicable |

### Response (200) — Demo Mode

Returned when `PAYMONGO_SECRET_KEY` is not configured.

```json
{
  "demo_mode": true,
  "booking_id": "<uuid>",
  "total_php": 8400.00,
  "message": "Payment gateway not configured. Booking is confirmed for demo."
}
```

### Error Responses

| Status | Condition |
|---|---|
| `400` | Schema validation failure |
| `401` | Missing or invalid JWT |
| `404` | Booking not found or does not belong to the authenticated user |
| `409` | Booking is not in a payable state; payment already in progress or completed |
| `429` | IP has exceeded 5 requests in the current 60-second window |
| `500` | Unexpected server error |
| `502` | PayMongo API returned a non-2xx status (details in `error.detail`) |

---


## 6. POST /functions/v1/paymongo-webhook

**Description:** Receive PayMongo webhook events for booking payment reconciliation.

**Authentication:** None (`--no-verify-jwt` deploy mode; trust established via signature verification).

### Request Headers

```
paymongo-signature: t=<unix_ts>,li=<hmac_hex>
Content-Type: application/json
```

### Supported events

- `checkout_session.payment.paid` — implemented; marks booking paid/captured when `metadata.booking_id` is present.
- `payment.failed`, `payment.refunded`, `payment.refund.updated` — accepted and safely ignored with `200` (no booking mutation).
- All unrelated events — safely ignored with `200`.

### Responses

| Status | Condition |
|---|---|
| `200` | Event processed, duplicate, or intentionally ignored |
| `400` | Malformed JSON payload or missing required event envelope fields |
| `401` | Invalid/missing `paymongo-signature` |
| `405` | Method not allowed (non-POST/non-OPTIONS) |
| `500` | Missing server-side configuration or database write failure |

### Required server secrets

- `PAYMONGO_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 7. POST /support-ticket

**Description:** Create a new support ticket. The function auto-detects escalation keywords and generates an AI first-response for non-escalated tickets.

**Authentication:** JWT Bearer required

**Rate limit:** 10 requests/min per user ID

### Request Headers

```
Authorization: Bearer <supabase_jwt>
```

### Request Body

```json
{
  "subject": "My booking wasn't confirmed",
  "message": "I booked a property 2 days ago and still haven't heard back.",
  "category": "booking",
  "priority": "normal"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `subject` | string | Yes | 3–200 characters |
| `message` | string | Yes | 5–4,000 characters |
| `category` | string | No | Max 64 characters |
| `priority` | enum | No | `"low"`, `"normal"` (default), `"high"`, or `"urgent"` |

**Auto-escalation:** The ticket is automatically escalated if `priority = "urgent"` or if the combined subject and message contains any of the following keywords (case-insensitive): `refund`, `fraud`, `chargeback`, `scam`, `urgent`, `legal`, `lawsuit`, `stolen`. Escalated tickets receive `status = 'escalated'` and bypass AI handling.

### Response (200)

```json
{
  "ticket_id": "<uuid>",
  "ticket_num": 1042,
  "ai_response": "<AI first-response text, or null if escalated>",
  "escalated": false
}
```

| Field | Type | Description |
|---|---|---|
| `ticket_id` | string (UUID) | Newly created ticket UUID |
| `ticket_num` | integer | Human-readable ticket number (sequential, starting at 1001) |
| `ai_response` | string or null | AI-generated first response; `null` if ticket was escalated or AI failed |
| `escalated` | boolean | `true` if auto-escalated or AI response failed; `false` otherwise |

### Error Responses

| Status | Condition |
|---|---|
| `400` | `subject` or `message` fails length validation, or `priority` is not a recognized value |
| `401` | Missing or invalid JWT |
| `429` | User has exceeded 10 requests in the current 60-second window |
| `500` | Database insert error or unexpected server error |

---

## 7. POST /support-message

**Description:** Add a follow-up message to an existing support ticket. The AI responds if the ticket is not escalated. Up to 20 messages of conversation history are passed to the AI as context.

**Authentication:** JWT Bearer required

**Rate limit:** 30 requests/min per user ID

### Request Headers

```
Authorization: Bearer <supabase_jwt>
```

### Request Body

```json
{
  "ticket_id": "<uuid>",
  "content": "I still haven't received a response from the host."
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `ticket_id` | string (UUID) | Yes | Must be a valid UUID of a ticket owned by the authenticated user |
| `content` | string | Yes | 1–4,000 characters |

**Notes:**
- The message is inserted via the user-scoped Supabase client; RLS blocks insertion if the ticket does not belong to the authenticated user
- If the ticket is not escalated, the function fetches up to 20 prior messages as context and generates an AI reply

### Response (200)

```json
{
  "ok": true,
  "ai_response": "<AI reply text, or null if escalated or AI failed>"
}
```

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` if the user message was successfully inserted |
| `ai_response` | string or null | AI reply to the new message; `null` if ticket is escalated or AI call failed |

### Error Responses

| Status | Condition |
|---|---|
| `400` | `ticket_id` is not a valid UUID, or `content` fails length validation |
| `401` | Missing or invalid JWT |
| `429` | User has exceeded 30 requests in the current 60-second window |
| `500` | RLS blocked the insert (ticket does not belong to the user), database error, or unexpected error |

---

## 8. POST /support-stream

**Description:** Stream an AI support response in real time via Server-Sent Events (SSE). Optionally scoped to a support ticket. The Groq streaming response is proxied directly to the client.

**Authentication:** JWT Bearer required

**Rate limit:** 20 requests/min per user ID

### Request Headers

```
Authorization: Bearer <supabase_jwt>
```

### Request Body

```json
{
  "ticket_id": "<uuid>",
  "prompt": "What are the cancellation terms for my booking?"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `ticket_id` | string (UUID) | No | Optional ticket UUID for context association |
| `prompt` | string | Yes | 1–2,000 characters |

### Response (200)

**Content-Type:** `text/event-stream`

The response is a raw SSE stream proxied from Groq. Each event contains a delta token from the model. Clients should use the `EventSource` API or an SSE client library to consume the stream.

**Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Error Responses

| Status | Condition |
|---|---|
| `400` | `prompt` is missing or fails length validation |
| `401` | Missing or invalid JWT |
| `429` | User has exceeded 20 requests in the current 60-second window |
| `500` | `GROQ_API_KEY` not configured, or unexpected server error |
| `502` | Groq returned a non-2xx status or an empty body |


## Payment Architecture (PayMongo + Stripe)

- Providers: `paymongo`, `stripe`; future providers are blocked by legal-approval feature flag (`ENABLE_UNAPPROVED_PROVIDERS=false`).
- Explicit booking payment state machine: `intent_created -> authorized -> captured -> refunding/refunded` and payout states `payout_on_hold -> payout_released`.
- Unsupported methods blocked when holds are required: prepaid, gift, anonymous reloadable, Interac-only debit, non-hold methods; wallets can pay but cannot secure incidentals if hold is required.
- Refund window and payout release dates are returned at checkout and persisted on booking (`refundable_until`, `payout_release_on`).
- Incidental charging requires `incidental_reviews` evidence path, guest response support, and manual gate for subjective cases before approval.


## 8. POST /omnihub-role-authority

**Description:** Centralized role authority mutation endpoint with audit emission through Omniport.

**Authentication:** JWT Bearer required (admin role checks enforced server-side).

**Notes:**
- Emits audit payloads via `_shared/omniport.ts` when `OMNIPORT_BASE_URL` and `OMNIPORT_TOKEN` are configured.
- `omni-recall/` is a governance/playbook tree (not an edge-function endpoint surface). API exposure remains through edge functions such as `omnihub-role-authority`.
