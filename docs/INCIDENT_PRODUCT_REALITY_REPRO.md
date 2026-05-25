# Incident Product Reality Repro (2026-05-24)

## Environment
- Date reproduced: 2026-05-24
- Commands used: `npm run test`, code inspection of host/guest flows

## Findings
1. **Host calendar empty date click is read-only**
   - `HostCalendar` day dialog currently states bookings are read-only and instructs users to use a separate blackout editor; no blackout action in the date modal.
2. **Host dashboard duplication**
   - Host page has separate `Calendar`, `Blackouts`, and `Bookings` tabs, each with independent action logic.
3. **Blackout behavior fragmented**
   - Blackout creation/removal is only in `BlackoutDateEditor`, not in calendar day action flow.
4. **Host confirmed booking cancellation flow missing in calendar**
   - Calendar modal only displays booking details; no cancel/replacement/refund warning flow.
5. **Guest cancellation missing for confirmed**
   - `MyBookings` only renders Cancel for `pending` status bookings.
6. **Payment safety messaging is unsafe**
   - `MyBookings.pay()` falls back to “pay at check-in” toast if checkout URL is absent, enabling confirmed unpaid ambiguity.
7. **Legal consent capture missing at signup UI**
   - `Auth` signup path has no Terms/Privacy required consent controls.

