# Database Schema Reference

**Organization:** JGP Corporation  
**Location:** Pasig City, Metro Manila, Philippines  
**Document Version:** 1.2.0  
**Last Updated:** 2026-05-21  
**Database:** PostgreSQL 17 (Supabase-managed)  
**Project Ref:** muqdmvkapsxrsgdkfoxn

---

## ENUMs

| Type | Values |
|---|---|
| `app_role` | `admin`, `host`, `member`, `user` |
| `ticket_status` | `open`, `pending`, `resolved`, `closed`, `escalated` |
| `ticket_priority` | `low`, `normal`, `high`, `urgent` |
| `message_sender` | `user`, `ai`, `admin`, `system` |
| `listing_status` | `draft`, `active`, `inactive`, `suspended` |
| `listing_type` | `entire_place`, `private_room`, `shared_room`, `glamping`, `villa`, `resort` |
| `booking_status` | `pending`, `confirmed`, `cancelled`, `completed`, `no_show` |
| `payment_status` | `unpaid`, `pending`, `paid`, `failed`, `refunded` |
| `payment_method` | `gcash`, `maya`, `card`, `bank_transfer`, `cash` |
| `host_verification_status` | `unverified`, `pending`, `verified`, `rejected` |

---

## Tables

### `profiles`
Auto-created on user signup via `handle_new_user()` trigger.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| user_id | UUID | NOT NULL | — | FK → auth.users, UNIQUE |
| display_name | TEXT | YES | — | |
| avatar_url | TEXT | YES | — | |
| bio | TEXT | YES | — | |
| created_at | TIMESTAMPTZ | NOT NULL | now() | |
| updated_at | TIMESTAMPTZ | NOT NULL | now() | Auto-updated by trigger |

**RLS:** Authenticated users read all; own INSERT/UPDATE only.

---

### `user_roles`
One row per (user, role) assignment.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| user_id | UUID | NOT NULL | — | FK → auth.users |
| role | app_role | NOT NULL | — | |
| granted_by | UUID | YES | — | FK → auth.users |
| created_at | TIMESTAMPTZ | NOT NULL | now() | |

**RLS:** Users read own roles; admin INSERT/UPDATE/DELETE only.  
**Indexes:** `(user_id)`, `(user_id, role)` UNIQUE.

---

### `role_audit_log`
Immutable log of every role change.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| target_user_id | UUID | FK → auth.users |
| role | app_role | Role that was changed |
| action | TEXT | `granted` or `revoked` |
| actor_id | UUID | Who made the change |
| created_at | TIMESTAMPTZ | |

**RLS:** Admin SELECT only. Populated by trigger.

---

### `support_tickets`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| subject | TEXT | 3–200 chars |
| message | TEXT | 5–4000 chars |
| category | TEXT | Optional |
| status | ticket_status | Default: `open` |
| priority | ticket_priority | Default: `normal` |
| ai_response | TEXT | AI-generated initial response |
| escalated_at | TIMESTAMPTZ | |
| created_at / updated_at | TIMESTAMPTZ | |

**RLS:** Owner + admin SELECT; authenticated INSERT (own); owner UPDATE (open/pending) + admin.

---

### `support_messages`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| ticket_id | UUID | FK → support_tickets |
| sender | message_sender | |
| content | TEXT | 1–4000 chars |
| created_at | TIMESTAMPTZ | |

**RLS:** Ticket owner + admin SELECT; ticket owner + admin INSERT.

---

### `host_profiles`
One-to-one with auth.users; created when a user applies to become a host.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → auth.users, UNIQUE |
| display_name | TEXT | |
| bio | TEXT | |
| phone | TEXT | |
| location | TEXT | City/region |
| id_photo_url | TEXT | URL to uploaded ID document |
| selfie_url | TEXT | URL to selfie |
| verification_status | host_verification_status | Default: `unverified` |
| verified_at | TIMESTAMPTZ | Set by admin on approval |
| response_rate | INT | 0–100%, updated by system |
| total_listings | INT | Counter |
| total_bookings | INT | Counter |
| created_at / updated_at | TIMESTAMPTZ | |

**RLS:**
- SELECT: verified profiles are public; owners see own.
- INSERT: authenticated, own user_id only.
- UPDATE: owner can set status to `unverified`/`pending` only; admin can set any value (prevents self-escalation to `verified`).

**Indexes:** `(user_id)`, `(verification_status)`.

---

### `listings`
Property listings created by verified hosts.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| host_id | UUID | FK → auth.users |
| title | TEXT | NOT NULL |
| slug | TEXT | UNIQUE, URL-friendly |
| description | TEXT | |
| type | listing_type | Default: `entire_place` |
| city | TEXT | NOT NULL |
| province | TEXT | NOT NULL |
| address | TEXT | |
| lat / lng | NUMERIC(10,7) | GPS coordinates |
| bedrooms | SMALLINT | ≥ 0 |
| bathrooms | NUMERIC(3,1) | |
| max_guests | SMALLINT | ≥ 1 |
| nightly_php | NUMERIC(10,2) | > 0 (Philippine Peso) |
| min_nights | SMALLINT | ≥ 1 |
| amenities | TEXT[] | e.g. `{wifi,aircon,pool}` |
| images | JSONB | Array of `{url, caption}` |
| is_owner_direct | BOOLEAN | Default: true |
| instant_book | BOOLEAN | Default: false |
| status | listing_status | Default: `active` |
| avg_rating | NUMERIC(3,2) | Auto-updated by trigger |
| review_count | INT | Auto-updated by trigger |
| created_at / updated_at | TIMESTAMPTZ | |

**RLS:**
- SELECT: anon/auth can read `active` listings; hosts read own; admins read all.
- INSERT: authenticated with `host` role only.
- UPDATE/DELETE: owner or admin.

**Indexes:** `(host_id)`, `(status)`, `(city)`, `(province)`, `(type)`, `(nightly_php)`.

---

### `bookings`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| listing_id | UUID | FK → listings |
| guest_id | UUID | FK → auth.users |
| host_id | UUID | FK → auth.users |
| check_in | DATE | NOT NULL |
| check_out | DATE | NOT NULL; must be > check_in |
| nights | SMALLINT | NOT NULL |
| guests | SMALLINT | Default: 1 |
| total_php | NUMERIC(10,2) | Server-computed (nights × nightly_php) |
| status | booking_status | Default: `pending` |
| payment_status | payment_status | Default: `unpaid` |
| payment_method | payment_method | Set on payment initiation |
| payment_ref | TEXT | External reference |
| paymongo_payment_intent_id | TEXT | PayMongo PI ID |
| guest_message | TEXT | |
| host_notes | TEXT | |
| confirmed_at / cancelled_at | TIMESTAMPTZ | |
| cancellation_reason | TEXT | |
| created_at / updated_at | TIMESTAMPTZ | |

**Constraint:** `check_out > check_in`.  
**RLS:** Guest + host + admin SELECT; guest INSERT (own guest_id); limited UPDATE per role.  
**Indexes:** `(listing_id)`, `(guest_id)`, `(host_id)`, `(status)`, `(check_in)`.

---

### `reviews`
One review per completed booking.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| booking_id | UUID | FK → bookings, UNIQUE |
| listing_id | UUID | FK → listings |
| reviewer_id | UUID | FK → auth.users |
| host_id | UUID | FK → auth.users |
| rating | SMALLINT | 1–5 |
| body | TEXT | ≤ 2000 chars |
| is_public | BOOLEAN | Default: true |
| created_at | TIMESTAMPTZ | |

**RLS:** Public reviews readable by anon; reviewer INSERT gated on completed booking; reviewer/admin UPDATE/DELETE.  
**Trigger:** `refresh_listing_rating()` recomputes `listings.avg_rating` and `listings.review_count` after every INSERT/UPDATE/DELETE.

---

## Functions

| Function | Security | Purpose |
|---|---|---|
| `update_updated_at_column()` | SECURITY DEFINER | Trigger: sets updated_at = now() on any UPDATE |
| `has_role(uuid, app_role)` | SECURITY DEFINER | Returns true if user has the given role; used in RLS policies |
| `handle_new_user()` | SECURITY DEFINER | Trigger: creates profiles row on auth.users INSERT |
| `log_role_change()` | SECURITY DEFINER | Trigger: inserts into role_audit_log on user_roles change |
| `refresh_listing_rating()` | SECURITY DEFINER | Trigger: updates avg_rating + review_count on reviews change |

All SECURITY DEFINER functions use `SET search_path = public` to prevent search path injection.

---

## Migration Files

| File | Applied | Description |
|---|---|---|
| `20260521073600_*.sql` | 2026-05-21 | Core schema: profiles, user_roles, role_audit_log, support tables |
| `20260521073625_*.sql` | 2026-05-21 | Security hardening: RLS revokes and function grants |
| `20260521081043_*.sql` | 2026-05-21 | Additional schema iteration |
| `20260521093000_rbac_concierge_rls_hardening.sql` | 2026-05-21 | RBAC hardening, concierge_requests |
| `20260521120000_listings_hosts_bookings.sql` | 2026-05-21 | Listings, host_profiles, bookings, reviews + RLS + indexes |
| `20260521120001_seed_listings.sql` | 2026-05-21 | 25 Philippine property listings (seed data) |
| `20260521130000_security_hardening.sql` | 2026-05-21 | RLS: prevent host self-verification escalation; lock down anon DML |

To apply a migration manually:
```bash
SUPABASE_ACCESS_TOKEN=<token> python3 supabase/scripts/apply_migration.py supabase/migrations/<file>.sql
```
