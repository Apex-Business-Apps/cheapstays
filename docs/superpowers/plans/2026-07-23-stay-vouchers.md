# Stay-Voucher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Groupon-style prepaid overnight stay voucher system: admin creates voucher batches per listing, anonymous public buys via PayMongo, host redeems the code at check-in which creates a `stay_type='voucher'` booking and credits the wallet via the standard payout schedule. Unredeemed codes expire in ≤14 days to platform revenue.

**Architecture:** Four new Postgres tables (`stay_voucher_batches`, `stay_voucher_codes`, `stay_voucher_purchases`, `platform_revenue_events`) coexisting with the existing hourly-voucher system. Eight new edge functions covering admin batch mutation, anonymous public checkout, PayMongo webhook, buyer success-page lookup, and host redemption. A pg_cron job runs the expiry sweep. Three public pages, one admin page (two tabs), one host redemption page, homepage carousel section, navbar link, sidebar entries.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind + shadcn/ui, Framer Motion, `react-router-dom` v6, `@tanstack/react-query`, Supabase Edge Functions (Deno), PostgreSQL 17 (via Supabase), PayMongo hosted checkout, Resend email.

## Global Constraints

- **Naming**: All new SQL identifiers use the `stay_voucher_` prefix; all new edge functions use the `stay-voucher-` prefix. This is to coexist with the pre-existing hourly-voucher system (`vouchers` table, `purchase-voucher` / `redeem-voucher` functions, `/vouchers` and `/host/vouchers` routes) that lives in `BookingPanel`, `HostVouchers`, `TodayActivityTab`. Do not touch or rename anything in the existing hourly-voucher system.
- **Voucher-code format**: `CS-XXXX-XXXX` — 8 uppercase Crockford-base32 chars (no `0/O/1/I/L`) after the fixed `CS-` prefix, using `crypto.getRandomValues`. On unique-index collision, regenerate up to 5 times per code.
- **Money**: All amounts stored as PHP integer pesos (`INT`), never floats. Platform fee is 10 % (constant `PLATFORM_FEE_RATE = 0.10` — matches existing `supabase/functions/credit-host-wallet/index.ts:7`).
- **Expiration cap**: `stay_voucher_batches.valid_days` is `CHECK BETWEEN 1 AND 14`.
- **Purchases per checkout**: `stay_voucher_purchases.quantity BETWEEN 1 AND 10`; batch quantity `BETWEEN 1 AND 500`.
- **RLS**: Every RLS policy that gates by role uses `public.has_role(auth.uid(), '<role>')` — never `auth.jwt() ->> 'role'` (per CLAUDE.md §17 trip-wire).
- **Rate limiting**: Every edge function must call `await rateLimit(...)` — omitting `await` silently bypasses limits (CLAUDE.md §11 trip-wire).
- **Edge function shape**: Every function begins with the `OPTIONS`/`corsHeaders` handler from `supabase/functions/_shared/cors.ts` and uses `getUserFromRequest` from `_shared/auth.ts` for authenticated endpoints, following `booking-checkout` and `admin-attach-disbursement-proof` as reference implementations.
- **Support message trip-wire (§17)**: Not relevant to this feature (no `support_messages` inserts).
- **Copy**: The user-visible product name is "voucher" (never "stay voucher" in copy). Only internal identifiers use the `stay_voucher_` prefix.

---

### Task 1: Migration — tables, RLS, redemption RPC, expiry cron

**Files:**
- Create: `supabase/migrations/20260723000000_stay_vouchers.sql`
- Modify: `src/integrations/supabase/types.ts` (auto-regenerated after migration — do not hand-edit; regenerate via `supabase gen types typescript --local`)

**Interfaces:**
- Consumes: existing tables `listings`, `bookings`, `auth.users`, `host_wallets` (referenced in FKs / RPC body only).
- Produces:
  - Tables `stay_voucher_batches`, `stay_voucher_codes`, `stay_voucher_purchases`, `platform_revenue_events`.
  - RPC `redeem_stay_voucher_transaction(p_code TEXT, p_listing_id UUID, p_caller_id UUID, p_check_in DATE) RETURNS JSONB`. Return shape: `{ success: true, booking_id: UUID, batch_id: UUID }` on success, or raises with a specific message on failure (see step 3 code).
  - Scheduled job `cheapstays-stay-voucher-expiry` runs every 6 h.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260723000000_stay_vouchers.sql`:

```sql
-- ============================================================
-- Stay Vouchers: batches, codes, anonymous purchases, expiry cron,
-- redemption RPC, and a generic platform revenue event log.
-- Coexists with the existing hourly-voucher system (public.vouchers).
-- ============================================================

-- 1. stay_voucher_batches --------------------------------------

CREATE TABLE IF NOT EXISTS public.stay_voucher_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  batch_name   TEXT NOT NULL,
  nights       INT  NOT NULL CHECK (nights BETWEEN 1 AND 30),
  price_php    INT  NOT NULL CHECK (price_php > 0),
  quantity     INT  NOT NULL CHECK (quantity BETWEEN 1 AND 500),
  valid_days   INT  NOT NULL CHECK (valid_days BETWEEN 1 AND 14),
  terms        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_voucher_batches_listing_idx
  ON public.stay_voucher_batches(listing_id);
CREATE INDEX IF NOT EXISTS stay_voucher_batches_active_idx
  ON public.stay_voucher_batches(is_active) WHERE is_active = true;

ALTER TABLE public.stay_voucher_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active batches"
  ON public.stay_voucher_batches FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin manages batches"
  ON public.stay_voucher_batches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. stay_voucher_purchases ------------------------------------

CREATE TABLE IF NOT EXISTS public.stay_voucher_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES public.stay_voucher_batches(id) ON DELETE RESTRICT,
  quantity          INT  NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  buyer_name        TEXT NOT NULL,
  buyer_email       TEXT NOT NULL,
  buyer_phone       TEXT NOT NULL,
  subtotal_php      INT  NOT NULL,
  payment_provider  TEXT NOT NULL DEFAULT 'paymongo',
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('gcash','maya','card')),
  payment_ref       TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed')),
  success_token     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stay_voucher_purchases_batch_idx
  ON public.stay_voucher_purchases(batch_id);
CREATE INDEX IF NOT EXISTS stay_voucher_purchases_payment_ref_idx
  ON public.stay_voucher_purchases(payment_ref) WHERE payment_ref IS NOT NULL;

ALTER TABLE public.stay_voucher_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads purchases"
  ON public.stay_voucher_purchases FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages purchases"
  ON public.stay_voucher_purchases FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 3. stay_voucher_codes ----------------------------------------

CREATE TABLE IF NOT EXISTS public.stay_voucher_codes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id               UUID NOT NULL REFERENCES public.stay_voucher_batches(id) ON DELETE RESTRICT,
  code                   TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'unclaimed'
                         CHECK (status IN ('unclaimed','claimed','expired')),
  purchase_id            UUID NOT NULL REFERENCES public.stay_voucher_purchases(id) ON DELETE RESTRICT,
  booking_id             UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  valid_until            TIMESTAMPTZ NOT NULL,
  redeemed_by_host_id    UUID REFERENCES auth.users(id),
  redeemed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_voucher_codes_batch_idx
  ON public.stay_voucher_codes(batch_id);
CREATE INDEX IF NOT EXISTS stay_voucher_codes_status_valid_idx
  ON public.stay_voucher_codes(status, valid_until);

ALTER TABLE public.stay_voucher_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host reads codes for their listings"
  ON public.stay_voucher_codes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'host')
    AND batch_id IN (
      SELECT b.id
      FROM public.stay_voucher_batches b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE l.host_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages codes"
  ON public.stay_voucher_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages codes"
  ON public.stay_voucher_codes FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 4. platform_revenue_events -----------------------------------

CREATE TABLE IF NOT EXISTS public.platform_revenue_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                TEXT NOT NULL,
  amount_php            INT NOT NULL,
  stay_voucher_code_id  UUID REFERENCES public.stay_voucher_codes(id) ON DELETE SET NULL,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_revenue_events_source_idx
  ON public.platform_revenue_events(source, occurred_at DESC);

ALTER TABLE public.platform_revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads revenue events"
  ON public.platform_revenue_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages revenue events"
  ON public.platform_revenue_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 5. bookings.guest_name_snapshot ------------------------------
-- Anonymous voucher redemptions have no guest_id — capture the buyer
-- name at redemption time so the booking is still identifiable.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_name_snapshot TEXT;

-- 6. Atomic redemption RPC -------------------------------------

CREATE OR REPLACE FUNCTION public.redeem_stay_voucher_transaction(
  p_code       TEXT,
  p_listing_id UUID,
  p_caller_id  UUID,
  p_check_in   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code       RECORD;
  v_batch      RECORD;
  v_purchase   RECORD;
  v_listing    RECORD;
  v_booking_id UUID;
BEGIN
  -- Lock the code row to prevent double-redemption races.
  SELECT * INTO v_code
    FROM public.stay_voucher_codes
    WHERE code = p_code
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher code not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_batch
    FROM public.stay_voucher_batches
    WHERE id = v_code.batch_id;
  IF v_batch.listing_id <> p_listing_id THEN
    RAISE EXCEPTION 'This voucher is for a different property.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF v_listing.host_id <> p_caller_id THEN
    RAISE EXCEPTION 'You do not host this listing.' USING ERRCODE = 'P0001';
  END IF;

  IF v_code.status = 'claimed' THEN
    RAISE EXCEPTION 'Voucher already redeemed.' USING ERRCODE = 'P0001';
  END IF;
  IF v_code.status = 'expired' OR v_code.valid_until < now() THEN
    RAISE EXCEPTION 'Voucher expired.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_purchase
    FROM public.stay_voucher_purchases
    WHERE id = v_code.purchase_id;

  INSERT INTO public.bookings (
    listing_id, guest_id, host_id, check_in, check_out,
    nights, guests, total_php, status, payment_status,
    stay_type, booking_flow, booking_mode,
    guest_name_snapshot, paid_at
  ) VALUES (
    p_listing_id, NULL, v_listing.host_id, p_check_in, p_check_in + v_batch.nights,
    v_batch.nights, 1, v_batch.price_php, 'confirmed', 'paid',
    'voucher', 'voucher', 'voucher',
    v_purchase.buyer_name, v_purchase.paid_at
  )
  RETURNING id INTO v_booking_id;

  UPDATE public.stay_voucher_codes
     SET status = 'claimed',
         booking_id = v_booking_id,
         redeemed_by_host_id = p_caller_id,
         redeemed_at = now()
   WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'batch_id', v_batch.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_stay_voucher_transaction(TEXT,UUID,UUID,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_stay_voucher_transaction(TEXT,UUID,UUID,DATE) TO service_role;

-- 7. Expiry sweep function + cron ------------------------------

CREATE OR REPLACE FUNCTION public.expire_stay_vouchers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.stay_voucher_codes c
       SET status = 'expired'
      FROM public.stay_voucher_batches b
     WHERE c.batch_id = b.id
       AND c.status = 'unclaimed'
       AND c.valid_until < now()
    RETURNING c.id, b.price_php
  ),
  revenue AS (
    INSERT INTO public.platform_revenue_events (source, amount_php, stay_voucher_code_id)
    SELECT 'voucher_expired', price_php, id FROM expired
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM revenue;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stay_vouchers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stay_vouchers() TO service_role;

-- Schedule via pg_cron. Guard against the extension not being installed
-- in local dev by checking pg_extension.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cheapstays-stay-voucher-expiry',
      '0 */6 * * *',
      $sql$ SELECT public.expire_stay_vouchers(); $sql$
    );
  END IF;
END $$;
```

- [ ] **Step 2: Write a Vitest static-analysis test for the migration**

Create `src/test/stay-voucher-migration.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260723000000_stay_vouchers.sql",
  "utf8",
);

describe("stay-voucher migration", () => {
  it("creates all four tables", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.stay_voucher_batches/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.stay_voucher_purchases/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.stay_voucher_codes/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.platform_revenue_events/);
  });

  it("caps valid_days at 14", () => {
    expect(migration).toMatch(/valid_days.*CHECK \(valid_days BETWEEN 1 AND 14\)/);
  });

  it("caps batch quantity at 500 and per-purchase quantity at 10", () => {
    expect(migration).toMatch(/quantity.*CHECK \(quantity BETWEEN 1 AND 500\)/);
    expect(migration).toMatch(/quantity.*CHECK \(quantity BETWEEN 1 AND 10\)/);
  });

  it("uses has_role for all admin/host policies (no JWT-claim fallback)", () => {
    expect(migration).not.toMatch(/auth\.jwt\(\)\s*->>?\s*'role'/);
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\), 'admin'\)/);
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\), 'host'\)/);
  });

  it("defines the atomic redemption RPC and locks the row", () => {
    expect(migration).toMatch(/redeem_stay_voucher_transaction/);
    expect(migration).toMatch(/FOR UPDATE/);
  });

  it("adds guest_name_snapshot to bookings", () => {
    expect(migration).toMatch(/ALTER TABLE public\.bookings[\s\S]*ADD COLUMN IF NOT EXISTS guest_name_snapshot TEXT/);
  });

  it("schedules the 6-hour expiry cron guarded by pg_extension check", () => {
    expect(migration).toMatch(/cheapstays-stay-voucher-expiry/);
    expect(migration).toMatch(/pg_extension WHERE extname = 'pg_cron'/);
  });
});
```

- [ ] **Step 3: Run the test — should PASS immediately** (static analysis of the file we just wrote)

Run: `npm run test -- src/test/stay-voucher-migration.test.ts`
Expected: all 7 assertions pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723000000_stay_vouchers.sql src/test/stay-voucher-migration.test.ts
git commit -m "feat(vouchers): schema, RLS, redemption RPC, and 6h expiry cron for stay vouchers"
```

---

### Task 2: TypeScript types file

**Files:**
- Create: `src/types/stay-vouchers.ts`
- Test: `src/test/stay-voucher-types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exported from `src/types/stay-vouchers.ts`):
  - `StayVoucherStatus = 'unclaimed' | 'claimed' | 'expired'`
  - `StayVoucherPaymentStatus = 'pending' | 'paid' | 'failed'`
  - `StayVoucherPaymentMethod = 'gcash' | 'maya' | 'card'`
  - Interfaces: `StayVoucherBatch`, `StayVoucherPurchase`, `StayVoucherCode`, `PlatformRevenueEvent`.
  - View-model type: `StayVoucherBatchWithListing` (batch fields + `listing: { id, title, city, hero_image_url }`) used by the public browse/detail pages.

- [ ] **Step 1: Write the failing test**

Create `src/test/stay-voucher-types.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type {
  StayVoucherBatch,
  StayVoucherCode,
  StayVoucherPurchase,
  PlatformRevenueEvent,
  StayVoucherStatus,
  StayVoucherPaymentMethod,
} from "@/types/stay-vouchers";

describe("stay-voucher types", () => {
  it("StayVoucherStatus is a closed union of three literals", () => {
    const values: StayVoucherStatus[] = ["unclaimed", "claimed", "expired"];
    expect(values).toHaveLength(3);
  });

  it("StayVoucherPaymentMethod accepts gcash/maya/card only", () => {
    const values: StayVoucherPaymentMethod[] = ["gcash", "maya", "card"];
    expect(values).toHaveLength(3);
  });

  it("compiles a StayVoucherBatch shape", () => {
    const b: StayVoucherBatch = {
      id: "id", listing_id: "l", batch_name: "n", nights: 1,
      price_php: 1999, quantity: 10, valid_days: 14, terms: null,
      is_active: true, created_by: "u", created_at: "2026-07-23T00:00:00Z",
    };
    expect(b.price_php).toBe(1999);
  });

  it("compiles a StayVoucherPurchase and StayVoucherCode and PlatformRevenueEvent", () => {
    const p: StayVoucherPurchase = {
      id: "p", batch_id: "b", quantity: 1,
      buyer_name: "x", buyer_email: "x@y", buyer_phone: "+63",
      subtotal_php: 1999, payment_provider: "paymongo", payment_method: "gcash",
      payment_ref: null, payment_status: "pending",
      success_token: "t", created_at: "2026-07-23T00:00:00Z", paid_at: null,
    };
    const c: StayVoucherCode = {
      id: "c", batch_id: "b", code: "CS-XXXX-XXXX",
      status: "unclaimed", purchase_id: "p", booking_id: null,
      valid_until: "2026-08-06T00:00:00Z",
      redeemed_by_host_id: null, redeemed_at: null,
      created_at: "2026-07-23T00:00:00Z",
    };
    const r: PlatformRevenueEvent = {
      id: "r", source: "voucher_expired", amount_php: 1999,
      stay_voucher_code_id: "c", occurred_at: "2026-08-06T00:00:00Z",
    };
    expect([p.payment_status, c.status, r.source]).toEqual(["pending", "unclaimed", "voucher_expired"]);
  });
});
```

- [ ] **Step 2: Run — expected FAIL (module missing)**

Run: `npm run test -- src/test/stay-voucher-types.test.ts`
Expected: TS error — Cannot find module `@/types/stay-vouchers`.

- [ ] **Step 3: Create the types file**

Create `src/types/stay-vouchers.ts`:

```typescript
export type StayVoucherStatus = "unclaimed" | "claimed" | "expired";
export type StayVoucherPaymentStatus = "pending" | "paid" | "failed";
export type StayVoucherPaymentMethod = "gcash" | "maya" | "card";

export interface StayVoucherBatch {
  id: string;
  listing_id: string;
  batch_name: string;
  nights: number;
  price_php: number;
  quantity: number;
  valid_days: number;
  terms: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface StayVoucherPurchase {
  id: string;
  batch_id: string;
  quantity: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  subtotal_php: number;
  payment_provider: string;
  payment_method: StayVoucherPaymentMethod;
  payment_ref: string | null;
  payment_status: StayVoucherPaymentStatus;
  success_token: string;
  created_at: string;
  paid_at: string | null;
}

export interface StayVoucherCode {
  id: string;
  batch_id: string;
  code: string;
  status: StayVoucherStatus;
  purchase_id: string;
  booking_id: string | null;
  valid_until: string;
  redeemed_by_host_id: string | null;
  redeemed_at: string | null;
  created_at: string;
}

export interface PlatformRevenueEvent {
  id: string;
  source: string;
  amount_php: number;
  stay_voucher_code_id: string | null;
  occurred_at: string;
}

export interface StayVoucherBatchWithListing extends StayVoucherBatch {
  listing: {
    id: string;
    title: string;
    city: string | null;
    hero_image_url: string | null;
  };
  unclaimed_count: number;
}
```

- [ ] **Step 4: Run — expected PASS**

Run: `npm run test -- src/test/stay-voucher-types.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/stay-vouchers.ts src/test/stay-voucher-types.test.ts
git commit -m "feat(vouchers): TypeScript types for stay-voucher tables"
```

---

### Task 3: Admin edge functions — batch create + deactivate

**Files:**
- Create: `supabase/functions/admin-stay-voucher-batch-create/index.ts`
- Create: `supabase/functions/admin-stay-voucher-batch-deactivate/index.ts`
- Test: `src/test/admin-stay-voucher-batches.test.ts`

**Interfaces:**
- Consumes: `stay_voucher_batches` table (Task 1), `_shared/cors.ts`, `_shared/auth.ts`, `_shared/rate-limit.ts`.
- Produces:
  - HTTP `POST /functions/v1/admin-stay-voucher-batch-create` — body `{ listing_id: UUID, batch_name: string, nights: int, price_php: int, quantity: int, valid_days: int, terms?: string }` → `{ batch_id: UUID }` (201) or `{ error }` (4xx/5xx).
  - HTTP `POST /functions/v1/admin-stay-voucher-batch-deactivate` — body `{ batch_id: UUID }` → `{ success: true }` or `{ error }`.

- [ ] **Step 1: Write the failing test**

Create `src/test/admin-stay-voucher-batches.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const createFn = readFileSync("supabase/functions/admin-stay-voucher-batch-create/index.ts", "utf8");
const deactivateFn = readFileSync("supabase/functions/admin-stay-voucher-batch-deactivate/index.ts", "utf8");

describe("admin-stay-voucher-batch-create", () => {
  it("enforces admin role via has_role", () => {
    expect(createFn).toContain(".rpc(\"has_role\"");
  });
  it("awaits the rate limit call", () => {
    expect(createFn).toMatch(/await rateLimit\(/);
  });
  it("validates the body with Zod including all six required fields", () => {
    expect(createFn).toContain("z.object");
    for (const field of ["listing_id","batch_name","nights","price_php","quantity","valid_days"]) {
      expect(createFn).toContain(field);
    }
  });
  it("caps nights, quantity, and valid_days at 30/500/14 respectively", () => {
    expect(createFn).toMatch(/\.max\(30\)/);
    expect(createFn).toMatch(/\.max\(500\)/);
    expect(createFn).toMatch(/\.max\(14\)/);
  });
});

describe("admin-stay-voucher-batch-deactivate", () => {
  it("enforces admin role via has_role", () => {
    expect(deactivateFn).toContain(".rpc(\"has_role\"");
  });
  it("awaits the rate limit call", () => {
    expect(deactivateFn).toMatch(/await rateLimit\(/);
  });
  it("only updates is_active — does not touch valid_until on existing codes", () => {
    expect(deactivateFn).toContain("is_active: false");
    expect(deactivateFn).not.toMatch(/stay_voucher_codes[\s\S]{0,400}status/);
  });
});
```

- [ ] **Step 2: Run — expected FAIL** (`readFileSync` throws — files don't exist).

Run: `npm run test -- src/test/admin-stay-voucher-batches.test.ts`
Expected: FAIL — ENOENT for both files.

- [ ] **Step 3: Implement `admin-stay-voucher-batch-create`**

Create `supabase/functions/admin-stay-voucher-batch-create/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  listing_id: z.string().uuid(),
  batch_name: z.string().min(1).max(120),
  nights:     z.number().int().min(1).max(30),
  price_php:  z.number().int().min(1),
  quantity:   z.number().int().min(1).max(500),
  valid_days: z.number().int().min(1).max(14),
  terms:      z.string().max(2000).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`admin-stay-voucher-batch-create:${ip}`, 30, 60_000);
  if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

  const { user, error: authErr } = await getUserFromRequest(req);
  if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { listing_id, batch_name, nights, price_php, quantity, valid_days, terms } = parsed.data;

  const { data: listing } = await admin
    .from("listings").select("id").eq("id", listing_id).maybeSingle();
  if (!listing) return json({ error: "Listing not found" }, 404);

  const { data: inserted, error } = await admin
    .from("stay_voucher_batches")
    .insert({
      listing_id, batch_name, nights, price_php, quantity, valid_days,
      terms: terms ?? null, is_active: true, created_by: user.id,
    })
    .select("id").single();
  if (error) return json({ error: error.message }, 500);

  return json({ batch_id: inserted.id }, 201);
});
```

- [ ] **Step 4: Implement `admin-stay-voucher-batch-deactivate`**

Create `supabase/functions/admin-stay-voucher-batch-deactivate/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({ batch_id: z.string().uuid() });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`admin-stay-voucher-batch-deactivate:${ip}`, 30, 60_000);
  if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

  const { user, error: authErr } = await getUserFromRequest(req);
  if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const { error } = await admin
    .from("stay_voucher_batches")
    .update({ is_active: false })
    .eq("id", parsed.data.batch_id);
  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
});
```

- [ ] **Step 5: Run — expected PASS**

Run: `npm run test -- src/test/admin-stay-voucher-batches.test.ts`
Expected: all 7 assertions pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-stay-voucher-batch-create/index.ts \
       supabase/functions/admin-stay-voucher-batch-deactivate/index.ts \
       src/test/admin-stay-voucher-batches.test.ts
git commit -m "feat(vouchers): admin edge functions to create and deactivate stay-voucher batches"
```

---

### Task 4: Public checkout edge function — `stay-voucher-checkout`

**Files:**
- Create: `supabase/functions/stay-voucher-checkout/index.ts`
- Test: `src/test/stay-voucher-checkout.test.ts`

**Interfaces:**
- Consumes: `stay_voucher_batches`, `stay_voucher_codes` (for the stock count), `stay_voucher_purchases` (writes a `pending` row), PayMongo API, `_shared/*` utilities.
- Produces:
  - HTTP `POST /functions/v1/stay-voucher-checkout` — **anonymous** (no auth header) — body:
    ```json
    { "batch_id": "UUID", "quantity": 1,
      "buyer_name": "str", "buyer_email": "str", "buyer_phone": "str",
      "payment_method": "gcash" | "maya" | "card",
      "accept_terms": true }
    ```
    → `{ checkout_url, purchase_id, success_token }` (200) or `{ error }`.

- [ ] **Step 1: Write the failing test**

Create `src/test/stay-voucher-checkout.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/stay-voucher-checkout/index.ts", "utf8");

describe("stay-voucher-checkout", () => {
  it("is anonymous (no getUserFromRequest call required)", () => {
    // Anonymous purchase — must not require auth
    expect(fn).not.toMatch(/getUserFromRequest/);
  });
  it("awaits the rate limit call", () => {
    expect(fn).toMatch(/await rateLimit\(/);
  });
  it("rejects the request when accept_terms is not true", () => {
    expect(fn).toMatch(/accept_terms/);
    expect(fn).toMatch(/z\.literal\(true\)/);
  });
  it("counts unclaimed codes against batch.quantity for stock", () => {
    expect(fn).toContain("stay_voucher_codes");
    expect(fn).toContain("unclaimed");
  });
  it("mints a cryptographic success_token before creating the PayMongo session", () => {
    expect(fn).toMatch(/crypto\.getRandomValues|randomUUID/);
    expect(fn).toContain("success_token");
    // token minted before insert
    const tokenIdx = fn.indexOf("success_token");
    const insertIdx = fn.indexOf("stay_voucher_purchases");
    expect(tokenIdx).toBeLessThan(insertIdx);
  });
  it("stores the PayMongo checkout session id on the purchase row", () => {
    expect(fn).toContain("payment_ref");
  });
  it("builds a PayMongo checkout session with metadata { purchase_id }", () => {
    expect(fn).toContain("checkout_sessions");
    expect(fn).toMatch(/metadata:\s*\{[^}]*purchase_id/);
  });
});
```

- [ ] **Step 2: Run — expected FAIL** (file missing).

- [ ] **Step 3: Implement the function**

Create `supabase/functions/stay-voucher-checkout/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const PAYMONGO_BASE = "https://api.paymongo.com/v1";
const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const BodySchema = z.object({
  batch_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  buyer_name: z.string().min(1).max(120),
  buyer_email: z.string().email().max(200),
  buyer_phone: z.string().min(6).max(30),
  payment_method: z.enum(["gcash","maya","card"]),
  accept_terms: z.literal(true),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mintSuccessToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CROCKFORD[b % CROCKFORD.length]).join("");
}

function pmHeaders(key: string, idempotencyKey: string) {
  return {
    Authorization: `Basic ${btoa(`${key}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`stay-voucher-checkout:${ip}`, 10, 60_000);
  if (!rl.ok) return json({ error: "Too many requests. Try again in a minute." }, 429);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { batch_id, quantity, buyer_name, buyer_email, buyer_phone, payment_method } = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: batch } = await admin
    .from("stay_voucher_batches")
    .select("id, listing_id, batch_name, nights, price_php, quantity, valid_days, is_active")
    .eq("id", batch_id).maybeSingle();
  if (!batch) return json({ error: "Voucher not found." }, 404);
  if (!batch.is_active) return json({ error: "This voucher is no longer available." }, 409);

  const { count: sold = 0 } = await admin
    .from("stay_voucher_codes").select("id", { count: "exact", head: true })
    .eq("batch_id", batch_id);
  if ((sold ?? 0) + quantity > batch.quantity) {
    return json({ error: "Not enough vouchers left in this batch." }, 409);
  }

  const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!paymongoKey) return json({ error: "Payment gateway not configured" }, 503);
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://cheapstays.me";

  const subtotal_php = batch.price_php * quantity;
  const success_token = mintSuccessToken();

  const { data: purchase, error: pErr } = await admin
    .from("stay_voucher_purchases")
    .insert({
      batch_id, quantity,
      buyer_name, buyer_email, buyer_phone,
      subtotal_php,
      payment_method,
      success_token,
      payment_status: "pending",
    })
    .select("id").single();
  if (pErr || !purchase) return json({ error: pErr?.message ?? "Failed to create purchase" }, 500);

  const pmMethod: Record<string, string[]> = { gcash: ["gcash"], maya: ["paymaya"], card: ["card"] };
  const idempotencyKey = `stay-voucher-checkout:${purchase.id}:${payment_method}:v1`;

  const sessionRes = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
    method: "POST",
    headers: pmHeaders(paymongoKey, idempotencyKey),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{
            currency: "PHP",
            amount: subtotal_php * 100,
            name: `Voucher: ${batch.batch_name}`,
            description: `${batch.nights} night${batch.nights === 1 ? "" : "s"} · ${quantity} voucher${quantity === 1 ? "" : "s"}`,
            quantity: 1,
          }],
          payment_method_types: pmMethod[payment_method],
          success_url: `${siteUrl}/stay-vouchers/success?purchase=${purchase.id}&token=${success_token}`,
          cancel_url:  `${siteUrl}/stay-vouchers/${batch_id}?cancelled=1`,
          metadata: { purchase_id: purchase.id, kind: "stay_voucher" },
        },
      },
    }),
  });
  const pmJson = await sessionRes.json() as {
    data?: { id: string; attributes: { checkout_url: string } };
    errors?: { detail: string }[];
  };
  if (!sessionRes.ok || !pmJson.data?.attributes?.checkout_url) {
    return json({ error: pmJson.errors?.[0]?.detail ?? "Payment provider error" }, 502);
  }

  await admin.from("stay_voucher_purchases")
    .update({ payment_ref: pmJson.data.id })
    .eq("id", purchase.id);

  return json({
    checkout_url: pmJson.data.attributes.checkout_url,
    purchase_id: purchase.id,
    success_token,
  }, 200);
});
```

- [ ] **Step 4: Run — expected PASS**

Run: `npm run test -- src/test/stay-voucher-checkout.test.ts`
Expected: all 7 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stay-voucher-checkout/index.ts src/test/stay-voucher-checkout.test.ts
git commit -m "feat(vouchers): anonymous stay-voucher checkout via PayMongo"
```

---

### Task 5: PayMongo webhook — `stay-voucher-webhook`

**Files:**
- Create: `supabase/functions/stay-voucher-webhook/index.ts`
- Test: `src/test/stay-voucher-webhook.test.ts`

**Interfaces:**
- Consumes: PayMongo webhook payload (validates signature via `_shared/paymongo-webhook.ts`), `webhook_events` table (idempotency, provider `paymongo_stay_voucher`), `stay_voucher_purchases`, `stay_voucher_batches`, `stay_voucher_codes` (writes codes).
- Produces:
  - HTTP `POST /functions/v1/stay-voucher-webhook` — signature-verified, no user auth.
  - Side effect: on `checkout_session.payment.paid` (or PayMongo equivalent supported by `SUPPORTED_PAYMONGO_EVENTS`), marks purchase paid, mints `quantity` unique codes with `valid_until = paid_at + batch.valid_days days`, sends buyer email via Resend, dispatches admin notification.

- [ ] **Step 1: Write the failing test**

Create `src/test/stay-voucher-webhook.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/stay-voucher-webhook/index.ts", "utf8");

describe("stay-voucher-webhook", () => {
  it("verifies PayMongo signature", () => {
    expect(fn).toContain("verifyPaymongoSignature");
  });
  it("is idempotent via webhook_events with provider paymongo_stay_voucher", () => {
    expect(fn).toContain("paymongo_stay_voucher");
    expect(fn).toContain("webhook_events");
  });
  it("mints exactly quantity codes and sets valid_until = paid_at + valid_days", () => {
    expect(fn).toMatch(/for \(let i = 0; i < .*quantity/);
    expect(fn).toMatch(/valid_days/);
  });
  it("retries code generation on unique-collision up to 5 times", () => {
    expect(fn).toMatch(/attempts?\s*<\s*5|MAX_CODE_ATTEMPTS/);
  });
  it("sends email via Resend when RESEND_API_KEY is set (graceful no-op otherwise)", () => {
    expect(fn).toContain("RESEND_API_KEY");
    expect(fn).toMatch(/api\.resend\.com/);
  });
  it("uses Crockford base32 for codes (no 0/O/1/I/L)", () => {
    expect(fn).toMatch(/23456789ABCDEFGHJKMNPQRSTVWXYZ/);
  });
});
```

- [ ] **Step 2: Run — expected FAIL**.

- [ ] **Step 3: Implement the webhook**

Create `supabase/functions/stay-voucher-webhook/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  PAYMONGO_SIGNATURE_HEADER, parsePaymongoEvent,
  SUPPORTED_PAYMONGO_EVENTS, verifyPaymongoSignature,
} from "../_shared/paymongo-webhook.ts";

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_CODE_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genCode(): string {
  const raw = new Uint8Array(8);
  crypto.getRandomValues(raw);
  const chars = Array.from(raw, (b) => CROCKFORD[b % CROCKFORD.length]).join("");
  return `CS-${chars.slice(0,4)}-${chars.slice(4,8)}`;
}

async function sendEmail(purchaseId: string, buyerEmail: string, batchName: string, codes: string[], validUntil: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const html = `
    <h2>Your CheapStays voucher${codes.length > 1 ? "s" : ""}</h2>
    <p><strong>${batchName}</strong></p>
    <p>Valid until <strong>${new Date(validUntil).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}</strong>.</p>
    <ul>${codes.map((c) => `<li style="font-family:monospace;font-size:20px">${c}</li>`).join("")}</ul>
    <p>Show your code to the host at check-in. Save this email — codes are non-refundable.</p>
    <p style="color:#888;font-size:12px">Reference: ${purchaseId.slice(0,8)}</p>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CheapStays <no-reply@cheapstays.me>",
      to: [buyerEmail],
      subject: `Your CheapStays voucher — ${codes[0]}${codes.length > 1 ? ` +${codes.length - 1} more` : ""}`,
      html,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secrets = [
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET_TEST"),
    Deno.env.get("PAYMONGO_WEBHOOK_SECRET_LIVE"),
  ].filter((s): s is string => !!s);
  if (!secrets.length) return json({ error: "No PayMongo webhook secret configured" }, 500);

  const rawBody = await req.text();
  const signatureHeader = req.headers.get(PAYMONGO_SIGNATURE_HEADER) ?? "";
  let sigOk = false;
  for (const s of secrets) {
    if (await verifyPaymongoSignature(rawBody, signatureHeader, s, 300)) { sigOk = true; break; }
  }
  if (!sigOk) return json({ error: "Invalid signature" }, 403);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let eventId: string, eventType: string, payload: ReturnType<typeof parsePaymongoEvent>["payload"];
  try {
    ({ eventId, eventType, payload } = parsePaymongoEvent(rawBody));
  } catch (err) {
    return json({ received: true, ignored: "unparseable", detail: (err as Error).message }, 200);
  }

  const { data: duplicate } = await admin
    .from("webhook_events").select("id")
    .eq("provider", "paymongo_stay_voucher").eq("event_id", eventId).maybeSingle();
  if (duplicate) return json({ received: true, duplicate: true }, 200);

  const record = async (purchaseId: string | null) => {
    try {
      await admin.from("webhook_events").insert({
        provider: "paymongo_stay_voucher",
        event_id: eventId, event_type: eventType,
        booking_id: null, // voucher webhooks don't reference bookings
      });
    } catch (err) { console.error("webhook_events insert (non-fatal):", err); }
  };

  if (!SUPPORTED_PAYMONGO_EVENTS.has(eventType)) {
    await record(null);
    return json({ received: true, ignored: eventType }, 200);
  }

  const resource = (payload as { data?: { attributes?: { data?: {
    id?: string;
    attributes?: { metadata?: Record<string,string>; payments?: Array<{ id?: string }> };
  } } } })?.data?.attributes?.data;
  const purchaseId = resource?.attributes?.metadata?.purchase_id;
  const sessionId  = resource?.id;
  if (!purchaseId && !sessionId) {
    await record(null);
    return json({ received: true, ignored: "no purchase_id" }, 200);
  }

  let { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, batch_id, quantity, buyer_email, payment_status")
    .eq("id", purchaseId ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (!purchase && sessionId) {
    const fb = await admin.from("stay_voucher_purchases")
      .select("id, batch_id, quantity, buyer_email, payment_status")
      .eq("payment_ref", sessionId).maybeSingle();
    purchase = fb.data;
  }
  if (!purchase) {
    await record(null);
    return json({ received: true, ignored: "purchase not found" }, 200);
  }
  if (purchase.payment_status === "paid") {
    await record(purchase.id);
    return json({ received: true, skipped: "already paid" }, 200);
  }

  const paidAt = new Date().toISOString();
  await admin.from("stay_voucher_purchases")
    .update({ payment_status: "paid", paid_at: paidAt })
    .eq("id", purchase.id);

  const { data: batch } = await admin
    .from("stay_voucher_batches")
    .select("id, batch_name, valid_days")
    .eq("id", purchase.batch_id).single();

  const validUntil = new Date(Date.now() + batch!.valid_days * 86_400_000).toISOString();
  const codes: string[] = [];
  for (let i = 0; i < purchase.quantity; i++) {
    let attempts = 0;
    while (attempts < MAX_CODE_ATTEMPTS) {
      const code = genCode();
      const { error } = await admin.from("stay_voucher_codes").insert({
        batch_id: purchase.batch_id, code, purchase_id: purchase.id, valid_until: validUntil,
      });
      if (!error) { codes.push(code); break; }
      if (!error.message.toLowerCase().includes("duplicate")) {
        console.error("code insert failed:", error);
        break;
      }
      attempts++;
    }
  }

  try { await sendEmail(purchase.id, purchase.buyer_email, batch!.batch_name, codes, validUntil); }
  catch (err) { console.error("resend send (non-fatal):", err); }

  // Notify admins in-app (best-effort — no admin ids known here; skip if not applicable).
  await record(purchase.id);
  return json({ received: true, processed: true, purchase_id: purchase.id, codes_minted: codes.length }, 200);
});
```

- [ ] **Step 4: Run — expected PASS**

Run: `npm run test -- src/test/stay-voucher-webhook.test.ts`
Expected: all 6 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stay-voucher-webhook/index.ts src/test/stay-voucher-webhook.test.ts
git commit -m "feat(vouchers): PayMongo webhook mints codes and emails the buyer"
```

---

### Task 6: Public lookup + resend edge functions

**Files:**
- Create: `supabase/functions/stay-voucher-purchase-lookup/index.ts`
- Create: `supabase/functions/stay-voucher-resend-email/index.ts`
- Test: `src/test/stay-voucher-lookup-resend.test.ts`

**Interfaces:**
- Consumes: `stay_voucher_purchases`, `stay_voucher_codes`, `stay_voucher_batches` (for `batch_name` in email).
- Produces:
  - `POST stay-voucher-purchase-lookup` body `{ purchase_id: UUID, success_token: string }` →
    `{ payment_status, codes: string[] | null, batch: { name, nights, price_php, valid_until, listing: { title, city } } }`.
  - `POST stay-voucher-resend-email` body `{ purchase_id: UUID, success_token: string }` → `{ sent: true }`.

- [ ] **Step 1: Write the failing test**

Create `src/test/stay-voucher-lookup-resend.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lookup = readFileSync("supabase/functions/stay-voucher-purchase-lookup/index.ts", "utf8");
const resend = readFileSync("supabase/functions/stay-voucher-resend-email/index.ts", "utf8");

describe("stay-voucher-purchase-lookup", () => {
  it("requires success_token match", () => {
    expect(lookup).toContain("success_token");
    expect(lookup).toMatch(/\.eq\("success_token"/);
  });
  it("does not return the code array unless payment_status === 'paid'", () => {
    // Codes are gated behind the paid check
    expect(lookup).toMatch(/payment_status\s*[!=]==?\s*['"]paid['"]/);
  });
  it("awaits the rate limit", () => {
    expect(lookup).toMatch(/await rateLimit\(/);
  });
});

describe("stay-voucher-resend-email", () => {
  it("verifies success_token before sending", () => {
    expect(resend).toContain("success_token");
    expect(resend).toMatch(/\.eq\("success_token"/);
  });
  it("caps at 5 requests per minute per purchase", () => {
    expect(resend).toMatch(/rateLimit\([^)]*purchase[^)]*,\s*5,\s*60_000\)/);
  });
});
```

- [ ] **Step 2: Run — expected FAIL**.

- [ ] **Step 3: Implement `stay-voucher-purchase-lookup`**

Create `supabase/functions/stay-voucher-purchase-lookup/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  purchase_id: z.string().uuid(),
  success_token: z.string().min(8).max(64),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`stay-voucher-purchase-lookup:${ip}`, 30, 60_000);
  if (!rl.ok) return json({ error: "Too many requests" }, 429);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { purchase_id, success_token } = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, batch_id, payment_status, paid_at")
    .eq("id", purchase_id)
    .eq("success_token", success_token)
    .maybeSingle();
  if (!purchase) return json({ error: "Not found" }, 404);

  const { data: batch } = await admin
    .from("stay_voucher_batches")
    .select("id, batch_name, nights, price_php, valid_days, listing_id")
    .eq("id", purchase.batch_id).single();

  const { data: listing } = await admin
    .from("listings").select("id, title, city").eq("id", batch!.listing_id).single();

  if (purchase.payment_status !== "paid") {
    return json({
      payment_status: purchase.payment_status, codes: null,
      batch: { name: batch!.batch_name, nights: batch!.nights, price_php: batch!.price_php,
               valid_until: null, listing },
    });
  }

  const { data: codes } = await admin
    .from("stay_voucher_codes")
    .select("code, valid_until")
    .eq("purchase_id", purchase_id)
    .order("created_at", { ascending: true });

  return json({
    payment_status: "paid",
    codes: (codes ?? []).map((c) => c.code),
    batch: {
      name: batch!.batch_name, nights: batch!.nights, price_php: batch!.price_php,
      valid_until: codes?.[0]?.valid_until ?? null,
      listing,
    },
  });
});
```

- [ ] **Step 4: Implement `stay-voucher-resend-email`**

Create `supabase/functions/stay-voucher-resend-email/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  purchase_id: z.string().uuid(),
  success_token: z.string().min(8).max(64),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { purchase_id, success_token } = parsed.data;

  const rl = await rateLimit(`stay-voucher-resend:purchase:${purchase_id}`, 5, 60_000);
  if (!rl.ok) return json({ error: "Please wait before requesting again." }, 429);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, batch_id, buyer_email, payment_status")
    .eq("id", purchase_id).eq("success_token", success_token).maybeSingle();
  if (!purchase) return json({ error: "Not found" }, 404);
  if (purchase.payment_status !== "paid") return json({ error: "Payment not completed" }, 409);

  const { data: batch } = await admin
    .from("stay_voucher_batches").select("batch_name")
    .eq("id", purchase.batch_id).single();
  const { data: codes } = await admin
    .from("stay_voucher_codes").select("code, valid_until")
    .eq("purchase_id", purchase_id).order("created_at", { ascending: true });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ sent: false, reason: "resend_not_configured" });

  const validUntil = codes?.[0]?.valid_until ?? "";
  const html = `
    <h2>Your CheapStays voucher</h2>
    <p><strong>${batch!.batch_name}</strong></p>
    <p>Valid until <strong>${new Date(validUntil).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}</strong>.</p>
    <ul>${(codes ?? []).map((c) => `<li style="font-family:monospace;font-size:20px">${c.code}</li>`).join("")}</ul>
    <p>Show your code to the host at check-in.</p>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CheapStays <no-reply@cheapstays.me>",
      to: [purchase.buyer_email],
      subject: `Your CheapStays voucher — ${codes?.[0]?.code ?? ""}`,
      html,
    }),
  });

  return json({ sent: true });
});
```

- [ ] **Step 5: Run — expected PASS**

Run: `npm run test -- src/test/stay-voucher-lookup-resend.test.ts`
Expected: all 5 assertions pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/stay-voucher-purchase-lookup/index.ts \
       supabase/functions/stay-voucher-resend-email/index.ts \
       src/test/stay-voucher-lookup-resend.test.ts
git commit -m "feat(vouchers): public purchase lookup + resend email for the success page"
```

---

### Task 7: Host preview + redeem edge functions

**Files:**
- Create: `supabase/functions/host-stay-voucher-preview/index.ts`
- Create: `supabase/functions/host-stay-voucher-redeem/index.ts`
- Test: `src/test/host-stay-voucher.test.ts`

**Interfaces:**
- Consumes: `stay_voucher_codes`, `stay_voucher_batches`, `stay_voucher_purchases`, `listings`, `has_role` RPC, `redeem_stay_voucher_transaction` RPC (Task 1).
- Produces:
  - `POST host-stay-voucher-preview` body `{ code: string }` → `{ batch_name, nights, price_php, buyer_name, valid_until, listing: { id, title } }` (200) or `{ error }`.
  - `POST host-stay-voucher-redeem` body `{ code: string, listing_id: UUID, check_in: "YYYY-MM-DD" }` → `{ booking_id: UUID }` (200) or `{ error }` with specific 400 messages.

- [ ] **Step 1: Write the failing test**

Create `src/test/host-stay-voucher.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const preview = readFileSync("supabase/functions/host-stay-voucher-preview/index.ts", "utf8");
const redeem  = readFileSync("supabase/functions/host-stay-voucher-redeem/index.ts", "utf8");

describe("host-stay-voucher-preview", () => {
  it("enforces host role via has_role", () => {
    expect(preview).toContain(".rpc(\"has_role\"");
    expect(preview).toMatch(/_role:\s*['"]host['"]/);
  });
  it("returns 404 when code is unknown", () => {
    expect(preview).toMatch(/Voucher code not found/);
  });
});

describe("host-stay-voucher-redeem", () => {
  it("delegates the write path to redeem_stay_voucher_transaction RPC", () => {
    expect(redeem).toContain("redeem_stay_voucher_transaction");
  });
  it("enforces host role via has_role", () => {
    expect(redeem).toContain(".rpc(\"has_role\"");
    expect(redeem).toMatch(/_role:\s*['"]host['"]/);
  });
  it("passes p_check_in as a YYYY-MM-DD date", () => {
    expect(redeem).toMatch(/p_check_in/);
    expect(redeem).toMatch(/z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  });
});
```

- [ ] **Step 2: Run — expected FAIL**.

- [ ] **Step 3: Implement `host-stay-voucher-preview`**

Create `supabase/functions/host-stay-voucher-preview/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({ code: z.string().min(6).max(32) });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`host-stay-voucher-preview:${ip}`, 20, 60_000);
  if (!rl.ok) return json({ error: "Too many requests" }, 429);

  const { user, error: authErr } = await getUserFromRequest(req);
  if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isHost } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "host",
  });
  if (!isHost) return json({ error: "Forbidden" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const code = parsed.data.code.trim().toUpperCase();

  const { data: row } = await admin
    .from("stay_voucher_codes")
    .select(`
      id, code, status, valid_until, purchase_id,
      batch:stay_voucher_batches(id, batch_name, nights, price_php, listing_id),
      purchase:stay_voucher_purchases(buyer_name)
    `)
    .eq("code", code)
    .maybeSingle();
  if (!row) return json({ error: "Voucher code not found" }, 404);

  const batch = (row as unknown as { batch: {
    id: string; batch_name: string; nights: number; price_php: number; listing_id: string;
  } }).batch;
  const { data: listing } = await admin
    .from("listings").select("id, title, host_id").eq("id", batch.listing_id).single();

  if (listing.host_id !== user.id) return json({ error: "You do not host this listing." }, 403);

  return json({
    batch_name: batch.batch_name,
    nights: batch.nights,
    price_php: batch.price_php,
    buyer_name: (row as unknown as { purchase: { buyer_name: string } }).purchase.buyer_name,
    valid_until: (row as { valid_until: string }).valid_until,
    status: (row as { status: string }).status,
    listing: { id: listing.id, title: listing.title },
  });
});
```

- [ ] **Step 4: Implement `host-stay-voucher-redeem`**

Create `supabase/functions/host-stay-voucher-redeem/index.ts`:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  code: z.string().min(6).max(32),
  listing_id: z.string().uuid(),
  p_check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`host-stay-voucher-redeem:${ip}`, 20, 60_000);
  if (!rl.ok) return json({ error: "Too many requests" }, 429);

  const { user, error: authErr } = await getUserFromRequest(req);
  if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isHost } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "host",
  });
  if (!isHost) return json({ error: "Forbidden" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const { data, error } = await admin.rpc("redeem_stay_voucher_transaction", {
    p_code: parsed.data.code.trim().toUpperCase(),
    p_listing_id: parsed.data.listing_id,
    p_caller_id: user.id,
    p_check_in: parsed.data.p_check_in,
  });
  if (error) return json({ error: error.message }, 400);
  return json(data as Record<string, unknown>, 200);
});
```

- [ ] **Step 5: Run — expected PASS**

Run: `npm run test -- src/test/host-stay-voucher.test.ts`
Expected: all 5 assertions pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/host-stay-voucher-preview/index.ts \
       supabase/functions/host-stay-voucher-redeem/index.ts \
       src/test/host-stay-voucher.test.ts
git commit -m "feat(vouchers): host preview + redeem via redeem_stay_voucher_transaction RPC"
```

---

### Task 8: Public browse + detail pages

**Files:**
- Create: `src/pages/stay-vouchers/StayVouchersIndex.tsx`
- Create: `src/pages/stay-vouchers/StayVoucherDetailPage.tsx`
- Create: `src/components/stay-vouchers/VoucherCard.tsx`
- Create: `src/components/stay-vouchers/VoucherPurchaseForm.tsx`
- Test: `src/test/stay-voucher-purchase-form.test.tsx`

**Interfaces:**
- Consumes: `StayVoucherBatchWithListing` type (Task 2), Supabase client, `stay-voucher-checkout` edge function.
- Produces: two default-exported page components mounted at `/stay-vouchers` and `/stay-vouchers/:batchId` (routing added in Task 12).

- [ ] **Step 1: Write the failing test**

Create `src/test/stay-voucher-purchase-form.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoucherPurchaseForm } from "@/components/stay-vouchers/VoucherPurchaseForm";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async () => ({ data: { checkout_url: "https://example.com/pay" }, error: null })),
    },
  },
}));

describe("<VoucherPurchaseForm>", () => {
  const batch = {
    id: "b1", batch_name: "Motel deal", nights: 1,
    price_php: 1999, valid_days: 14, listing_title: "Villa X",
  };

  it("disables submit until the rules checkbox is checked", () => {
    render(<VoucherPurchaseForm batch={batch} />);
    const btn = screen.getByRole("button", { name: /buy voucher/i });
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/i understand.*non-refundable/i));
    // still disabled until fields filled
    fireEvent.change(screen.getByLabelText(/name/i),  { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+639171234567" } });
    expect(btn).not.toBeDisabled();
  });

  it("calls stay-voucher-checkout with the selected payment method", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    // window.location.assign is a JSDOM stub — spy it
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign }, writable: true });
    render(<VoucherPurchaseForm batch={batch} />);
    fireEvent.click(screen.getByLabelText(/i understand.*non-refundable/i));
    fireEvent.change(screen.getByLabelText(/name/i),  { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+639171234567" } });
    fireEvent.click(screen.getByRole("button", { name: /buy voucher/i }));
    await waitFor(() => {
      expect((supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>))
        .toHaveBeenCalledWith("stay-voucher-checkout", expect.objectContaining({
          body: expect.objectContaining({
            batch_id: "b1", quantity: 1, buyer_name: "Ana", buyer_email: "a@b.co",
            buyer_phone: "+639171234567", accept_terms: true,
          }),
        }));
    });
    expect(assign).toHaveBeenCalledWith("https://example.com/pay");
  });
});
```

- [ ] **Step 2: Run — expected FAIL** (component missing).

- [ ] **Step 3: Implement `VoucherCard`**

Create `src/components/stay-vouchers/VoucherCard.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";

export function VoucherCard({ batch }: { batch: StayVoucherBatchWithListing }) {
  const soldOut = batch.unclaimed_count >= batch.quantity;
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-secondary/40 relative">
        {batch.listing.hero_image_url && (
          <img src={batch.listing.hero_image_url} alt={batch.listing.title}
               className="h-full w-full object-cover" loading="lazy" />
        )}
        <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
          {batch.nights} night{batch.nights === 1 ? "" : "s"}
        </Badge>
        {soldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">Sold out</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium truncate">{batch.listing.title}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {batch.listing.city ?? "PH"}
        </p>
        <p className="text-lg font-semibold">₱{batch.price_php.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Valid {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"}
        </p>
        <Link
          to={`/stay-vouchers/${batch.id}`}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 pt-1"
        >
          {soldOut ? "View details" : "Buy voucher"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Implement `VoucherPurchaseForm`**

Create `src/components/stay-vouchers/VoucherPurchaseForm.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  batch: {
    id: string; batch_name: string; nights: number;
    price_php: number; valid_days: number; listing_title: string;
  };
};

export function VoucherPurchaseForm({ batch }: Props) {
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");
  const [phone,  setPhone]  = useState("");
  const [method, setMethod] = useState<"gcash"|"maya"|"card">("gcash");
  const [accept, setAccept] = useState(false);
  const [busy,   setBusy]   = useState(false);

  const canSubmit = accept && name.length > 0 && email.includes("@") && phone.length >= 6 && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("stay-voucher-checkout", {
      body: { batch_id: batch.id, quantity: 1,
              buyer_name: name, buyer_email: email, buyer_phone: phone,
              payment_method: method, accept_terms: true },
    });
    if (error || !(data as { checkout_url?: string })?.checkout_url) {
      setBusy(false);
      toast.error((error as Error | null)?.message ?? "Could not start checkout. Please try again.");
      return;
    }
    window.location.assign((data as { checkout_url: string }).checkout_url);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="v-name">Name</Label>
        <Input id="v-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="v-email">Email</Label>
        <Input id="v-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="v-phone">Phone</Label>
        <Input id="v-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63…" />
      </div>
      <div className="space-y-2">
        <Label>Payment method</Label>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)}
                    className="grid grid-cols-3 gap-2">
          {(["gcash","maya","card"] as const).map((m) => (
            <div key={m} className="flex items-center gap-2 border rounded-md p-2">
              <RadioGroupItem id={`v-${m}`} value={m} />
              <Label htmlFor={`v-${m}`} className="capitalize text-sm">{m}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <Checkbox checked={accept} onCheckedChange={(v) => setAccept(v === true)} className="mt-0.5" />
        <span>I understand this voucher is <strong>non-refundable</strong>, valid for {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"} after purchase, and must be redeemed with the host at check-in.</span>
      </label>
      <Button type="submit" disabled={!canSubmit} className="w-full min-h-[44px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Buy voucher — ₱${batch.price_php.toLocaleString()}`}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Implement `StayVouchersIndex`**

Create `src/pages/stay-vouchers/StayVouchersIndex.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Seo } from "@/components/Seo";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";
import { VoucherCard } from "@/components/stay-vouchers/VoucherCard";

export default function StayVouchersIndex() {
  const [batches, setBatches] = useState<StayVoucherBatchWithListing[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("stay_voucher_batches")
        .select(`
          id, listing_id, batch_name, nights, price_php, quantity, valid_days,
          terms, is_active, created_by, created_at,
          listing:listings(id, title, city, hero_image_url:images)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const rows = (data ?? []).map((b) => {
        const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
        return {
          ...b,
          listing: { id: l?.id, title: l?.title, city: l?.city ?? null,
                     hero_image_url: Array.isArray(l?.hero_image_url) ? l!.hero_image_url[0] ?? null : null },
          unclaimed_count: 0,
        } as unknown as StayVoucherBatchWithListing;
      });
      setBatches(rows);
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Seo title="Voucher deals · CheapStays" description="Prepaid stay vouchers." path="/stay-vouchers" />
      <h1 className="text-2xl font-semibold mb-1">Voucher deals</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Prepaid overnight stays at discounted prices. Redeem with the host at check-in.
      </p>
      {batches === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No voucher deals right now — check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {batches.map((b) => <VoucherCard key={b.id} batch={b} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement `StayVoucherDetailPage`**

Create `src/pages/stay-vouchers/StayVoucherDetailPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VoucherPurchaseForm } from "@/components/stay-vouchers/VoucherPurchaseForm";

type BatchRow = {
  id: string; batch_name: string; nights: number; price_php: number;
  valid_days: number; terms: string | null; is_active: boolean;
  listing: { id: string; title: string; city: string | null; description: string | null; images: string[] | null };
};

export default function StayVoucherDetailPage() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState<BatchRow | null | undefined>(undefined);

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      const { data } = await supabase
        .from("stay_voucher_batches")
        .select(`
          id, batch_name, nights, price_php, valid_days, terms, is_active,
          listing:listings(id, title, city, description, images)
        `)
        .eq("id", batchId).maybeSingle();
      if (!data) { setBatch(null); return; }
      const l = Array.isArray(data.listing) ? data.listing[0] : data.listing;
      setBatch({ ...data, listing: l } as BatchRow);
    })();
  }, [batchId]);

  if (batch === undefined) return <div className="p-8"><Skeleton className="h-40" /></div>;
  if (batch === null || !batch.is_active) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Voucher not available</h1>
        <p className="text-sm text-muted-foreground mb-4">This deal is no longer active.</p>
        <Link to="/stay-vouchers" className="text-sm text-primary hover:underline">Browse other vouchers</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Seo title={`${batch.batch_name} · CheapStays`} description={`Voucher deal for ${batch.listing.title}`} path={`/stay-vouchers/${batch.id}`} />
      <Link to="/stay-vouchers" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> All vouchers
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {batch.listing.images?.[0] && (
            <img src={batch.listing.images[0]} alt={batch.listing.title}
                 className="w-full rounded-md object-cover aspect-[4/3]" />
          )}
          <h1 className="text-xl font-semibold">{batch.listing.title}</h1>
          <p className="text-sm text-muted-foreground">{batch.listing.city}</p>
          {batch.listing.description && (
            <p className="text-sm">{batch.listing.description}</p>
          )}
        </div>
        <Card className="p-5 space-y-3 h-fit">
          <div>
            <p className="text-xs text-muted-foreground">{batch.batch_name}</p>
            <p className="text-3xl font-semibold">₱{batch.price_php.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {batch.nights} night{batch.nights === 1 ? "" : "s"} · one voucher
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Redeem within {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"} of purchase.
          </p>
          {batch.terms && <p className="text-[11px] text-muted-foreground">{batch.terms}</p>}
          <VoucherPurchaseForm batch={{
            id: batch.id, batch_name: batch.batch_name, nights: batch.nights,
            price_php: batch.price_php, valid_days: batch.valid_days,
            listing_title: batch.listing.title,
          }} />
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run — expected PASS**

Run: `npm run test -- src/test/stay-voucher-purchase-form.test.tsx`
Expected: both tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/pages/stay-vouchers/ src/components/stay-vouchers/ \
       src/test/stay-voucher-purchase-form.test.tsx
git commit -m "feat(vouchers): public browse and detail pages with anonymous purchase form"
```

---

### Task 9: Public success page

**Files:**
- Create: `src/pages/stay-vouchers/StayVoucherSuccessPage.tsx`
- Create: `src/components/stay-vouchers/VoucherCodeDisplay.tsx`

**Interfaces:**
- Consumes: `stay-voucher-purchase-lookup`, `stay-voucher-resend-email` edge functions.
- Produces: default-exported page mounted at `/stay-vouchers/success` (routing in Task 12).

- [ ] **Step 1: Implement `VoucherCodeDisplay`**

Create `src/components/stay-vouchers/VoucherCodeDisplay.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function VoucherCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border p-4 flex items-center justify-between gap-4 bg-secondary/30">
      <span className="font-mono text-2xl tracking-widest select-all">{code}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="min-h-[44px]"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `StayVoucherSuccessPage`**

Create `src/pages/stay-vouchers/StayVoucherSuccessPage.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VoucherCodeDisplay } from "@/components/stay-vouchers/VoucherCodeDisplay";
import { toast } from "sonner";

type Lookup = {
  payment_status: "pending" | "paid" | "failed";
  codes: string[] | null;
  batch: {
    name: string; nights: number; price_php: number;
    valid_until: string | null;
    listing: { id: string; title: string; city: string | null };
  };
};

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 60; // 3 minutes

export default function StayVoucherSuccessPage() {
  const [params] = useSearchParams();
  const purchaseId = params.get("purchase");
  const token = params.get("token");

  const [state, setState] = useState<Lookup | null | undefined>(undefined);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!purchaseId || !token) return;
    let cancelled = false;
    const tick = async () => {
      const { data, error } = await supabase.functions.invoke("stay-voucher-purchase-lookup", {
        body: { purchase_id: purchaseId, success_token: token },
      });
      if (error) { setState(null); return; }
      if (cancelled) return;
      setState(data as Lookup);
      if ((data as Lookup).payment_status !== "paid" && pollCount.current < MAX_POLLS) {
        pollCount.current++;
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [purchaseId, token]);

  if (!purchaseId || !token) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Missing purchase reference.</div>;
  }
  if (state === undefined) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (state === null) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-2">
        <h1 className="text-xl font-semibold">Purchase not found</h1>
        <p className="text-sm text-muted-foreground">The link may be incorrect. Check your email for the code.</p>
        <Link to="/stay-vouchers" className="text-sm text-primary hover:underline">Browse vouchers</Link>
      </div>
    );
  }

  const resend = async () => {
    const { error } = await supabase.functions.invoke("stay-voucher-resend-email", {
      body: { purchase_id: purchaseId, success_token: token },
    });
    if (error) toast.error("Could not resend right now. Try again in a minute.");
    else toast.success("Sent — check your inbox.");
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      <Seo title="Your voucher · CheapStays" description="Voucher purchase confirmation." path="/stay-vouchers/success" />
      <Card className="p-6 space-y-4 text-center">
        {state.payment_status === "paid" ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div>
              <h1 className="text-xl font-semibold">Voucher{(state.codes ?? []).length > 1 ? "s" : ""} ready</h1>
              <p className="text-sm text-muted-foreground">
                {state.batch.name} · {state.batch.nights} night{state.batch.nights === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                For <strong>{state.batch.listing.title}</strong>{state.batch.listing.city ? `, ${state.batch.listing.city}` : ""}
              </p>
            </div>
            <div className="space-y-2 text-left">
              {(state.codes ?? []).map((c) => <VoucherCodeDisplay key={c} code={c} />)}
            </div>
            {state.batch.valid_until && (
              <p className="text-xs text-muted-foreground">
                Valid until <strong>{new Date(state.batch.valid_until).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}</strong>. Save this code — show it to the host at check-in.
              </p>
            )}
            <Button type="button" variant="outline" onClick={resend} className="min-h-[44px]">
              <MailCheck className="h-4 w-4 mr-2" /> Resend email
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <h1 className="text-lg font-semibold">Finalising your voucher…</h1>
            <p className="text-sm text-muted-foreground">
              Waiting for payment confirmation. This usually takes a few seconds.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/stay-vouchers/StayVoucherSuccessPage.tsx \
       src/components/stay-vouchers/VoucherCodeDisplay.tsx
git commit -m "feat(vouchers): success page with polling, code display, and email resend"
```

---

### Task 10: Admin `/admin/stay-vouchers` page

**Files:**
- Create: `src/pages/admin/StayVouchersPage.tsx`
- Create: `src/components/stay-vouchers/AdminVoucherBatchForm.tsx`
- Create: `src/components/stay-vouchers/AdminVoucherBatchList.tsx`
- Create: `src/components/stay-vouchers/AdminVoucherPurchasesTable.tsx`

**Interfaces:**
- Consumes: `admin-stay-voucher-batch-create`, `admin-stay-voucher-batch-deactivate`, `stay-voucher-resend-email`, Supabase tables `stay_voucher_batches`, `stay_voucher_purchases`, `stay_voucher_codes`, `listings`.
- Produces: default-exported page mounted at `/admin/stay-vouchers` (routing in Task 12).

- [ ] **Step 1: Implement `AdminVoucherBatchForm`**

Create `src/components/stay-vouchers/AdminVoucherBatchForm.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Listing = { id: string; title: string };

export function AdminVoucherBatchForm({ onSaved }: { onSaved: () => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listing_id, setListingId] = useState("");
  const [batch_name, setName] = useState("");
  const [nights, setNights] = useState(1);
  const [price_php, setPrice] = useState(1999);
  const [quantity, setQuantity] = useState(50);
  const [valid_days, setValidDays] = useState(14);
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("listings").select("id,title").eq("status", "active").order("title")
      .then(({ data }) => setListings((data ?? []) as Listing[]));
  }, []);

  const canSubmit = listing_id && batch_name && nights > 0 && price_php > 0 && quantity > 0
                  && valid_days >= 1 && valid_days <= 14 && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-stay-voucher-batch-create", {
      body: { listing_id, batch_name, nights, price_php, quantity, valid_days,
              terms: terms || undefined },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Voucher batch created.");
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="b-listing">Listing</Label>
        <select id="b-listing" required value={listing_id} onChange={(e) => setListingId(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Select a listing…</option>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="b-name">Batch name</Label>
        <Input id="b-name" required value={batch_name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="b-nights">Nights</Label>
          <Input id="b-nights" type="number" min={1} max={30}
                 value={nights} onChange={(e) => setNights(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="b-price">Price (₱)</Label>
          <Input id="b-price" type="number" min={1}
                 value={price_php} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="b-qty">Quantity</Label>
          <Input id="b-qty" type="number" min={1} max={500}
                 value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="b-valid">Valid days (1–14)</Label>
          <Input id="b-valid" type="number" min={1} max={14}
                 value={valid_days} onChange={(e) => setValidDays(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <Label htmlFor="b-terms">Terms / inclusions (optional)</Label>
        <Textarea id="b-terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)}
                  placeholder="Free breakfast, late check-out, etc." />
      </div>
      <Button type="submit" disabled={!canSubmit} className="w-full min-h-[44px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create batch"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Implement `AdminVoucherBatchList`**

Create `src/components/stay-vouchers/AdminVoucherBatchList.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string; batch_name: string; nights: number; price_php: number;
  quantity: number; valid_days: number; is_active: boolean;
  listing: { title: string };
  sold_count: number;
};

export function AdminVoucherBatchList({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const { data: bs } = await supabase.from("stay_voucher_batches")
      .select("id, batch_name, nights, price_php, quantity, valid_days, is_active, listing:listings(title)")
      .order("created_at", { ascending: false });
    const ids = (bs ?? []).map((b) => b.id);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: cs } = await supabase.from("stay_voucher_codes")
        .select("batch_id").in("batch_id", ids);
      counts = (cs ?? []).reduce((m, r) => m.set(r.batch_id, (m.get(r.batch_id) ?? 0) + 1), new Map<string, number>());
    }
    setRows((bs ?? []).map((b) => ({
      ...b,
      listing: Array.isArray(b.listing) ? b.listing[0] : b.listing,
      sold_count: counts.get(b.id) ?? 0,
    })) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const deactivate = async (id: string) => {
    const { error } = await supabase.functions.invoke("admin-stay-voucher-batch-deactivate", { body: { batch_id: id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Deactivated.");
    load();
  };

  if (rows === null) return <Skeleton className="h-40" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No batches yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground text-left">
          <tr>
            <th className="py-2">Listing</th><th>Batch</th><th>Price</th><th>Nights</th>
            <th>Sold / Qty</th><th>Valid</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 truncate max-w-[200px]">{r.listing?.title}</td>
              <td>{r.batch_name}</td>
              <td>₱{r.price_php.toLocaleString()}</td>
              <td>{r.nights}</td>
              <td>{r.sold_count} / {r.quantity}</td>
              <td>{r.valid_days}d</td>
              <td>
                <Badge variant={r.is_active ? "default" : "secondary"}>
                  {r.is_active ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="text-right">
                {r.is_active && (
                  <Button variant="ghost" size="sm" onClick={() => deactivate(r.id)} className="min-h-[44px]">
                    Deactivate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Implement `AdminVoucherPurchasesTable`**

Create `src/components/stay-vouchers/AdminVoucherPurchasesTable.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string; buyer_name: string; buyer_email: string; buyer_phone: string;
  payment_status: string; created_at: string;
  batch: { batch_name: string; listing: { title: string } };
  codes: { code: string; status: string }[];
};

export function AdminVoucherPurchasesTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ps } = await supabase.from("stay_voucher_purchases")
        .select(`
          id, buyer_name, buyer_email, buyer_phone, payment_status, created_at,
          batch:stay_voucher_batches(batch_name, listing:listings(title))
        `)
        .order("created_at", { ascending: false }).limit(200);
      const ids = (ps ?? []).map((p) => p.id);
      let codesByPurchase = new Map<string, { code: string; status: string }[]>();
      if (ids.length) {
        const { data: cs } = await supabase.from("stay_voucher_codes")
          .select("purchase_id, code, status").in("purchase_id", ids);
        codesByPurchase = (cs ?? []).reduce((m, r) => {
          const list = m.get(r.purchase_id) ?? [];
          list.push({ code: r.code, status: r.status });
          m.set(r.purchase_id, list);
          return m;
        }, new Map<string, { code: string; status: string }[]>());
      }
      setRows((ps ?? []).map((p) => {
        const batch = Array.isArray(p.batch) ? p.batch[0] : p.batch;
        return {
          ...p,
          batch: { ...batch, listing: Array.isArray(batch?.listing) ? batch.listing[0] : batch?.listing },
          codes: codesByPurchase.get(p.id) ?? [],
        } as Row;
      }));
    })();
  }, []);

  if (rows === null) return <Skeleton className="h-40" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No purchases yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground text-left">
          <tr>
            <th className="py-2">Buyer</th><th>Email</th><th>Phone</th>
            <th>Listing</th><th>Batch</th><th>Codes</th>
            <th>Purchase</th><th>Bought</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="py-2">{r.buyer_name}</td>
              <td className="text-xs text-muted-foreground">{r.buyer_email}</td>
              <td className="text-xs text-muted-foreground">{r.buyer_phone}</td>
              <td className="truncate max-w-[200px]">{r.batch?.listing?.title}</td>
              <td>{r.batch?.batch_name}</td>
              <td className="space-y-0.5">
                {r.codes.map((c) => (
                  <div key={c.code} className="flex items-center gap-1 text-xs">
                    <span className="font-mono">{c.code}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge>
                  </div>
                ))}
              </td>
              <td>
                <Badge variant={r.payment_status === "paid" ? "default" : "secondary"} className="text-[10px] capitalize">
                  {r.payment_status}
                </Badge>
              </td>
              <td className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-PH")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement `StayVouchersPage`**

Create `src/pages/admin/StayVouchersPage.tsx`:

```tsx
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Seo } from "@/components/Seo";
import { AdminVoucherBatchForm } from "@/components/stay-vouchers/AdminVoucherBatchForm";
import { AdminVoucherBatchList } from "@/components/stay-vouchers/AdminVoucherBatchList";
import { AdminVoucherPurchasesTable } from "@/components/stay-vouchers/AdminVoucherPurchasesTable";

export default function StayVouchersPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Seo title="Voucher Deals · Admin" description="Manage prepaid stay vouchers." path="/admin/stay-vouchers" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Voucher deals</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]"><Plus className="h-4 w-4 mr-1" /> New batch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create voucher batch</DialogTitle></DialogHeader>
            <AdminVoucherBatchForm onSaved={() => { setReloadKey((k) => k + 1); setDialogOpen(false); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="batches">
        <TabsList className="mb-6">
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>
        <TabsContent value="batches">
          <Card className="p-5"><AdminVoucherBatchList reloadKey={reloadKey} /></Card>
        </TabsContent>
        <TabsContent value="purchases">
          <Card className="p-5"><AdminVoucherPurchasesTable /></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/StayVouchersPage.tsx src/components/stay-vouchers/
git commit -m "feat(vouchers): admin page with batch create/list and purchases table"
```

---

### Task 11: Host `/host/redeem-stay-voucher` page

**Files:**
- Create: `src/pages/host/RedeemStayVoucherPage.tsx`
- Create: `src/components/stay-vouchers/HostRedeemForm.tsx`
- Test: `src/test/host-redeem-form.test.tsx`

**Interfaces:**
- Consumes: `host-stay-voucher-preview`, `host-stay-voucher-redeem` edge functions, `listings` table, `useAuth` hook.
- Produces: default-exported page mounted at `/host/redeem-stay-voucher` (routing in Task 12).

- [ ] **Step 1: Write the failing test**

Create `src/test/host-redeem-form.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HostRedeemForm } from "@/components/stay-vouchers/HostRedeemForm";

const invoke = vi.fn(async (name: string) => {
  if (name === "host-stay-voucher-preview") {
    return { data: {
      batch_name: "Motel deal", nights: 1, price_php: 1999,
      buyer_name: "Ana", valid_until: "2026-08-06T00:00:00Z", status: "unclaimed",
      listing: { id: "l1", title: "Villa X" },
    }, error: null };
  }
  return { data: { success: true, booking_id: "book-1" }, error: null };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [
        { id: "l1", title: "Villa X" }
      ] }) }) }) }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, roles: ["host"] }) }));

describe("<HostRedeemForm>", () => {
  it("auto-uppercases the code as the host types", () => {
    render(<HostRedeemForm />);
    const input = screen.getByLabelText(/voucher code/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "cs-abcd-1234" } });
    expect(input.value).toBe("CS-ABCD-1234");
  });

  it("calls preview then redeem", async () => {
    render(<HostRedeemForm />);
    fireEvent.change(screen.getByLabelText(/voucher code/i), { target: { value: "CS-AAAA-BBBB" } });
    // wait for listings load then select
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l1" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/motel deal/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/check-in/i), { target: { value: "2026-07-24" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm redemption/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("host-stay-voucher-redeem", expect.any(Object)));
  });
});
```

- [ ] **Step 2: Run — expected FAIL**.

- [ ] **Step 3: Implement `HostRedeemForm`**

Create `src/components/stay-vouchers/HostRedeemForm.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Preview = {
  batch_name: string; nights: number; price_php: number;
  buyer_name: string; valid_until: string; status: string;
  listing: { id: string; title: string };
};

export function HostRedeemForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [listingId, setListingId] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [busy, setBusy] = useState<"preview" | "redeem" | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("listings").select("id,title").eq("host_id", user.id).eq("status", "active").order("title")
      .then((res: unknown) => setListings((res as { data: { id: string; title: string }[] }).data ?? []));
  }, [user?.id]);

  const onPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !listingId) return;
    setBusy("preview");
    const { data, error } = await supabase.functions.invoke("host-stay-voucher-preview", { body: { code } });
    setBusy(null);
    if (error) { toast.error(error.message); setPreview(null); return; }
    const p = data as Preview;
    if (p.listing.id !== listingId) {
      toast.error("This voucher is for a different property.");
      setPreview(null);
      return;
    }
    setPreview(p);
    setCheckIn(new Date().toISOString().slice(0, 10));
  };

  const onRedeem = async () => {
    if (!preview || !checkIn) return;
    setBusy("redeem");
    const { data, error } = await supabase.functions.invoke("host-stay-voucher-redeem", {
      body: { code, listing_id: listingId, p_check_in: checkIn },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const { booking_id } = data as { booking_id: string };
    toast.success("Voucher redeemed. Booking created.");
    navigate(`/host/bookings?highlight=${booking_id}`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onPreview} className="space-y-3">
        <div>
          <Label htmlFor="r-listing">Listing</Label>
          <select id="r-listing" role="combobox" required value={listingId} onChange={(e) => setListingId(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Select a listing…</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="r-code">Voucher code</Label>
          <Input id="r-code" value={code} required
                 onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="CS-XXXX-XXXX" />
        </div>
        <Button type="submit" disabled={busy !== null || !code || !listingId} className="min-h-[44px]">
          {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
        </Button>
      </form>

      {preview && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">{preview.batch_name}</p>
            <p className="text-sm font-medium">{preview.listing.title}</p>
            <p className="text-xs text-muted-foreground">
              {preview.nights} night{preview.nights === 1 ? "" : "s"} · ₱{preview.price_php.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Guest: <strong>{preview.buyer_name}</strong></p>
            <p className="text-[10px] text-muted-foreground">
              Valid until {new Date(preview.valid_until).toLocaleString("en-PH")}
            </p>
          </div>
          <div>
            <Label htmlFor="r-checkin">Check-in date</Label>
            <Input id="r-checkin" type="date" required value={checkIn}
                   onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <Button onClick={onRedeem} disabled={busy !== null || !checkIn} className="w-full min-h-[44px]">
            {busy === "redeem" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm redemption"}
          </Button>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `RedeemStayVoucherPage`**

Create `src/pages/host/RedeemStayVoucherPage.tsx`:

```tsx
import { Card } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { HostRedeemForm } from "@/components/stay-vouchers/HostRedeemForm";

export default function RedeemStayVoucherPage() {
  return (
    <div className="max-w-lg mx-auto">
      <Seo title="Redeem voucher · CheapStays" description="Redeem a guest's voucher at check-in." path="/host/redeem-stay-voucher" />
      <h1 className="text-2xl font-semibold mb-1">Redeem voucher</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Enter the code the guest shows you at check-in. We'll create the booking and credit your wallet on the standard payout schedule.
      </p>
      <Card className="p-5">
        <HostRedeemForm />
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Run — expected PASS**

Run: `npm run test -- src/test/host-redeem-form.test.tsx`
Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/host/RedeemStayVoucherPage.tsx \
       src/components/stay-vouchers/HostRedeemForm.tsx \
       src/test/host-redeem-form.test.tsx
git commit -m "feat(vouchers): host redemption page with preview + confirm"
```

---

### Task 12: Wiring — App routes, sidebar, homepage section, navbar

**Files:**
- Modify: `src/App.tsx` — add public, admin, and host routes.
- Modify: `src/components/AppSidebar.tsx` — add admin "Voucher Deals" and host "Redeem Voucher" entries.
- Modify: `src/pages/Index.tsx` — insert `<VoucherDealsSection />` between `<Hero />` and `<PopularCitiesSection />`.
- Create: `src/components/homepage/VoucherDealsSection.tsx`
- Create: `src/components/homepage/index.ts` addition (append `VoucherDealsSection` export).

**Interfaces:**
- Consumes: everything from Tasks 8–11 and `src/types/stay-vouchers.ts`.

- [ ] **Step 1: Create `VoucherDealsSection`**

Create `src/components/homepage/VoucherDealsSection.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";
import { VoucherCard } from "@/components/stay-vouchers/VoucherCard";

export function VoucherDealsSection() {
  const [batches, setBatches] = useState<StayVoucherBatchWithListing[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stay_voucher_batches")
        .select(`
          id, listing_id, batch_name, nights, price_php, quantity, valid_days,
          terms, is_active, created_by, created_at,
          listing:listings(id, title, city, images)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      const rows = (data ?? []).map((b) => {
        const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
        return {
          ...b,
          listing: { id: l?.id, title: l?.title, city: l?.city ?? null,
                     hero_image_url: Array.isArray(l?.images) ? l!.images[0] ?? null : null },
          unclaimed_count: 0,
        } as unknown as StayVoucherBatchWithListing;
      });
      setBatches(rows);
    })();
  }, []);

  if (batches.length === 0) return null;

  return (
    <section className="py-10 px-4 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Voucher deals</h2>
          <p className="text-sm text-muted-foreground">Prepaid stays at discounted prices.</p>
        </div>
        <Link to="/stay-vouchers" className="text-xs text-primary hover:underline flex items-center gap-1">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {batches.slice(0, 4).map((b) => <VoucherCard key={b.id} batch={b} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into homepage**

Edit `src/pages/Index.tsx`:

```typescript
// change the imports block to include VoucherDealsSection
import {
  Hero,
  VoucherDealsSection,          // NEW
  PopularCitiesSection,
  FeaturedStaysSection,
  QuickStaysSection,
  BecomeHost,
} from "@/components/homepage";
```

Then in the JSX, add `<VoucherDealsSection />` right after `<Hero />` and before `<PopularCitiesSection />`.

Also append `VoucherDealsSection` export to `src/components/homepage/index.ts`:

```typescript
export { VoucherDealsSection } from "./VoucherDealsSection";
```

- [ ] **Step 3: Add routes in `src/App.tsx`**

Add lazy imports at the top of the `// Public pages` block:

```typescript
const StayVouchersIndex        = lazy(() => import("./pages/stay-vouchers/StayVouchersIndex"));
const StayVoucherDetailPage    = lazy(() => import("./pages/stay-vouchers/StayVoucherDetailPage"));
const StayVoucherSuccessPage   = lazy(() => import("./pages/stay-vouchers/StayVoucherSuccessPage"));
```

Add in the `// Host dashboard pages` block:

```typescript
const HostRedeemStayVoucherPage = lazy(() => import("./pages/host/RedeemStayVoucherPage"));
```

Add in the `// Admin dashboard pages` block:

```typescript
const AdminStayVouchersPage = lazy(() => import("./pages/admin/StayVouchersPage"));
```

Add the public routes inside the `<Route element={<PublicLayout />}>` block, immediately after `/vouchers`:

```tsx
<Route path="/stay-vouchers"             element={<StayVouchersIndex />} />
<Route path="/stay-vouchers/success"     element={<StayVoucherSuccessPage />} />
<Route path="/stay-vouchers/:batchId"    element={<StayVoucherDetailPage />} />
```

Add the host route inside `<Route element={<DashboardLayout requiredRole="host" />}>`:

```tsx
<Route path="/host/redeem-stay-voucher" element={<HostRedeemStayVoucherPage />} />
```

Add the admin route inside `<Route element={<DashboardLayout requiredRole="admin" />}>`:

```tsx
<Route path="/admin/stay-vouchers"      element={<AdminStayVouchersPage />} />
```

- [ ] **Step 4: Add sidebar entries**

Edit `src/components/AppSidebar.tsx`:

1. Add `Gift` to the icon import: `import { …, Gift } from "lucide-react";`
2. Insert into `adminItems` after the Disbursements entry:
   ```typescript
   { label: "Voucher Deals", to: "/admin/stay-vouchers", icon: Gift },
   ```
3. Insert into `hostItems` after the Vouchers entry:
   ```typescript
   { label: "Redeem Voucher", to: "/host/redeem-stay-voucher", icon: Gift },
   ```

- [ ] **Step 5: Type-check and lint**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx \
       src/pages/Index.tsx src/components/homepage/VoucherDealsSection.tsx \
       src/components/homepage/index.ts
git commit -m "feat(vouchers): wire routes, sidebar entries, and homepage voucher-deals section"
```

---

### Task 13: End-to-end Playwright test

**Files:**
- Create: `e2e/stay-voucher-purchase.spec.ts`

**Interfaces:**
- Consumes: the running dev server. This test does **not** mock PayMongo — it stops at the redirect boundary and asserts the checkout URL is issued.

- [ ] **Step 1: Write the spec**

Create `e2e/stay-voucher-purchase.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("stay-voucher public flow", () => {
  test("browse page renders", async ({ page }) => {
    await page.goto("/stay-vouchers");
    await expect(page.getByRole("heading", { name: /voucher deals/i })).toBeVisible();
  });

  test("detail page shows purchase form when a batch is seeded", async ({ page }) => {
    await page.goto("/stay-vouchers");
    const firstCard = page.getByRole("link", { name: /buy voucher|view details/i }).first();
    if (!(await firstCard.count())) test.skip(true, "no active batches seeded");
    await firstCard.click();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/i understand.*non-refundable/i)).toBeVisible();
    // Submit button is disabled until the checkbox is checked
    const btn = page.getByRole("button", { name: /buy voucher/i });
    await expect(btn).toBeDisabled();
  });

  test("success page requires purchase and token params", async ({ page }) => {
    await page.goto("/stay-vouchers/success");
    await expect(page.getByText(/missing purchase reference/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run — expected PASS (or `skip` when no seeded batches)**

Run: `npx playwright test e2e/stay-voucher-purchase.spec.ts`
Expected: 3 passes (one may skip depending on seed data).

- [ ] **Step 3: Commit**

```bash
git add e2e/stay-voucher-purchase.spec.ts
git commit -m "test(vouchers): playwright e2e for public voucher browse and success gates"
```

---

### Task 14: Documentation — CLAUDE.md updates + PR

**Files:**
- Modify: `CLAUDE.md` — add §4.10, §5 rows, three §17 trip-wires.

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Add §4.10 to CLAUDE.md**

Insert after §4.9 in `CLAUDE.md`:

```markdown
### 4.10 Stay Voucher Functions (prepaid overnight stays)

Coexists with the pre-existing hourly-voucher system (§4.9 is Manual Disbursement, then §4.10 is the new stay vouchers). Do not confuse `stay_voucher_*` with the pre-existing hourly `vouchers` table, `purchase-voucher`, and `redeem-voucher` functions — those are a separate, still-live product.

#### `admin-stay-voucher-batch-create`
- **Auth:** admin only (`has_role`).
- **Body:** `{ listing_id, batch_name, nights, price_php, quantity, valid_days, terms? }`. Caps: nights ≤30, quantity ≤500, valid_days 1–14.
- **Effect:** inserts a `stay_voucher_batches` row.

#### `admin-stay-voucher-batch-deactivate`
- **Auth:** admin only.
- **Body:** `{ batch_id }`. Sets `is_active=false`. Existing purchased codes remain valid until their own `valid_until`.

#### `stay-voucher-checkout` (anonymous public)
- **Auth:** none.
- **Body:** `{ batch_id, quantity, buyer_name, buyer_email, buyer_phone, payment_method, accept_terms: true }`.
- **Flow:** stock check → insert `stay_voucher_purchases` with minted `success_token` → PayMongo checkout session (metadata `{ purchase_id, kind: "stay_voucher" }`) → returns `{ checkout_url, purchase_id, success_token }`.
- **Rate limit:** 10 req/60s per IP.

#### `stay-voucher-webhook`
- **Auth:** PayMongo signature.
- **Effect:** idempotent via `webhook_events(provider='paymongo_stay_voucher', event_id)`; marks purchase `paid`, mints `quantity` codes with `valid_until = paid_at + batch.valid_days days`, emails buyer via Resend.

#### `stay-voucher-purchase-lookup` (anonymous public)
- **Auth:** none — verifies `success_token`.
- **Body:** `{ purchase_id, success_token }` → `{ payment_status, codes | null, batch: { name, nights, price_php, valid_until, listing } }`.

#### `stay-voucher-resend-email` (anonymous public)
- **Auth:** none — verifies `success_token`.
- **Body:** `{ purchase_id, success_token }`. Rate limit: 5 req/60s per purchase.

#### `host-stay-voucher-preview`
- **Auth:** host only.
- **Body:** `{ code }` → batch + buyer name + `valid_until` if host owns the listing; else 403.

#### `host-stay-voucher-redeem`
- **Auth:** host only.
- **Body:** `{ code, listing_id, p_check_in }`.
- **Effect:** calls the `redeem_stay_voucher_transaction(p_code, p_listing_id, p_caller_id, p_check_in)` RPC which locks the code row, verifies listing/host ownership + status + expiry, inserts a `stay_type='voucher'` booking (`payment_status='paid'`, `status='confirmed'`, `guest_id=NULL`, `guest_name_snapshot=buyer_name`), and updates the voucher to `claimed`. Wallet crediting follows the standard paid-booking pipeline (`credit-host-wallet` 10 % fee, `release-pending-balance` 1 day after check-out).
```

- [ ] **Step 2: Extend §5 (Key Tables)**

Append to the table:

```markdown
| `stay_voucher_batches` | Admin-created prepaid stay voucher batches | listing_id, nights, price_php, quantity, valid_days (1–14), is_active |
| `stay_voucher_codes`   | Individual redeemable codes (`CS-XXXX-XXXX`) | batch_id, code UNIQUE, status ('unclaimed'/'claimed'/'expired'), purchase_id, valid_until |
| `stay_voucher_purchases` | Anonymous PayMongo purchases | batch_id, buyer_name/email/phone, success_token (nonce), payment_status |
| `platform_revenue_events` | Generic platform revenue log | source ('voucher_expired' at ship time), amount_php, stay_voucher_code_id |
```

Also add a note under Key Tables:

```markdown
**`bookings.guest_name_snapshot`** — nullable column populated only when the booking was created via voucher redemption. Anonymous voucher purchases have no `auth.users` row, so the buyer name is carried onto the booking via this snapshot.
```

- [ ] **Step 3: Add §17 trip-wires**

Append to §17:

```markdown
### ❌ Confusing the hourly voucher system with the stay voucher system
The codebase runs two independent voucher products:
- **Hourly vouchers** (older): tables `vouchers`, RPC `redeem_voucher_transaction`, edge functions `purchase-voucher`/`redeem-voucher`, UI in `BookingPanel`/`HostVouchers`/`TodayActivityTab`, public route `/vouchers`, host route `/host/vouchers`.
- **Stay vouchers** (this feature): tables `stay_voucher_*`, RPC `redeem_stay_voucher_transaction`, edge functions `stay-voucher-*` / `admin-stay-voucher-*` / `host-stay-voucher-*`, UI in `src/components/stay-vouchers/*` and `src/pages/stay-vouchers/*`, public routes under `/stay-vouchers`, host route `/host/redeem-stay-voucher`, admin route `/admin/stay-vouchers`.
Do not rename one to the other. Do not merge tables. Anything referring to a batch (`batch_id`), an anonymous buyer, or a `stay_voucher_` identifier is the new system.

### ❌ Inserting `stay_voucher_purchases` from the client
Client SDK insert bypasses the server-generated `success_token` and PayMongo idempotency key. The success page's anonymous lookup relies on that token being minted server-side. Always call the `stay-voucher-checkout` edge function.

### ❌ Redeeming a voucher without going through the RPC
The redemption path must go through `redeem_stay_voucher_transaction`. The RPC locks the code row (`FOR UPDATE`) to block concurrent double-redemption, and inserts the `bookings` row + updates the code row + snapshots the buyer name in one transaction. Client-side or edge-function-side sequenced writes will race and can create ghost bookings or leave codes in inconsistent states.
```

- [ ] **Step 4: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: register stay voucher edge functions, tables, and trip-wires"
git push -u origin feat/vouchers
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --base main --head feat/vouchers \
  --title "feat: stay vouchers — prepaid overnight stays sold to anonymous buyers" \
  --body "$(cat <<'EOF'
## Summary

- Admin creates voucher batches per listing (price + fixed nights + quantity + 1–14 day validity).
- Anonymous public buys individual codes via `/stay-vouchers` → PayMongo checkout.
- Buyer receives code by email + prominently on the success page.
- Host redeems the code at check-in via `/host/redeem-stay-voucher` — the redemption RPC creates a `stay_type='voucher'` booking and the standard payout pipeline credits the wallet 10%/90%.
- Unredeemed vouchers expire in ≤14 days to platform revenue via a 6h pg_cron sweep.

Coexists with the pre-existing hourly-voucher system; all new identifiers are prefixed `stay_voucher_` / `stay-voucher-` to prevent collisions.

## Test plan

- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all green.
- [ ] Seed one active batch → verify it renders on `/stay-vouchers`, homepage `VoucherDealsSection`, and the batch's detail page.
- [ ] Complete an anonymous checkout in PayMongo sandbox → success page polls to `paid` state and displays the code.
- [ ] Sign in as a host → open `/host/redeem-stay-voucher`, redeem the code → new booking visible in `/host/bookings`; the code row updates to `status='claimed'`.
- [ ] Sign in as admin → `/admin/stay-vouchers` batches tab shows the batch, purchases tab shows the anonymous buyer with their codes and status pills.
- [ ] Run `SELECT public.expire_stay_vouchers();` after tinkering with a code's `valid_until` to backdate it — verify status flips to `expired` and a `platform_revenue_events` row is created.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Verify CI is green** on the PR before requesting review.

---

## Post-Implementation Verification

After all tasks are committed and pushed:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Then manually walk the full flow against a local Supabase:
1. Sign in as admin → create a batch for one of your listings (₱1,999, 1 night, qty 5, valid 7 days).
2. Sign out. Visit homepage → click into a voucher card → complete a PayMongo sandbox checkout.
3. On the success page, confirm the code appears within ~10 seconds.
4. Sign in as the host of that listing → `/host/redeem-stay-voucher` → paste the code → preview → confirm.
5. Verify `/host/bookings` shows the new voucher booking and `guest_name_snapshot` is the buyer's name.
6. Verify `host_wallets.pending_balance` picked up ₱1,799.10 (₱1,999 × 0.9).
7. In `/admin/stay-vouchers` **Purchases** tab, verify the row is present with the code marked `claimed`.
