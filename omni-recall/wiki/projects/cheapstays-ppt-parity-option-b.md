# CheapStays PPTX Parity (Option B)

**Project Identifier:** cheapstays-ppt-parity-option-b
**Implementation Date:** 2026-06-20
**Scope:** Align current Supabase / React codebase with the target product deck features: Quick-Stay, Hourly Bookings, and Voucher Marketplace functionality.

## Core Decisions
- **Option B selected over Option A**: Re-used the existing codebase and expanded the data models rather than a ground-up rewrite.
- **Hourly Occupancy Model**: Additive migration to `bookings` (`stay_type`, `arrival_time`, `duration_hours`, `starts_at`, `ends_at`) provides true temporal querying capabilities. Avoided stuffing metadata into unstructured `guest_message` blocks.
- **Voucher Model**: Additive migration for `vouchers` table. Vouchers maintain an `active`/`redeemed` lifecycle. 
- **Atomic Redemptions**: `redeem_voucher_transaction` Postgres RPC implemented to wrap the `vouchers` read and `bookings` insert into a single `FOR UPDATE` lock. This removes network race conditions causing duplicate redemptions.

## Implementation Map

### 1. Database (Domain Rules)
- Expanded `listings.booking_mode` to `nightly`, `hourly`, and `voucher`.
- Added block pricing integers to `listings`: `price_3h`, `price_6h`, `price_12h`.
- Restructured `bookings` check constraints to validate proper time limits based on `stay_type`.

### 2. Edge Functions
- `purchase-voucher`: Processes intent and issues an 8-character unique tracking code. Uses `pending_payment` states to ensure money tracking aligns before issuing active vouchers.
- `redeem-voucher`: Enforces host verification (`listing.host_id === caller_id`) and idempotency (prevents double redemption, outputs the same `booking_id`).
- `book-listing`: Reconfigured to handle `hourly` boundaries and deny overlapping reservations dynamically.

### 3. Interface Layer
- `ListingDetail.tsx` + `BookingPanel.tsx`: Seamlessly adapts UI state between nightly calendars, hourly block selectors, and open-date voucher acquisitions based on `listing.booking_mode`.
- `Host.tsx` + `HostVouchers.tsx`: Extends the operational dashboard to allow hosts to directly validate and physically redeem vouchers brought on-site.

## Omni-Recall Learnings
- **Evidence-Led Delivery:** Complex state migrations (like atomic bookings) must be tested against RLS/RPC integration rules before declaring success.
- **Future Direction:** Keep pricing blocks distinct from hourly math to support unique marketing or promotion caps.

---
*Generated per Omni-Recall Master Blueprint standard via Option B deployment path.*
