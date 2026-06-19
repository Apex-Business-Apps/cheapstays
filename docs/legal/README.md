# CheapStays Legal Document Suite

**Operator:** JGP Corporation, Pasig City, Metro Manila, Philippines  
**Platform:** CheapStays (cheapstays.me)  
**Suite version:** 1.0.0  
**Effective:** 2026-05-22  
**Jurisdictions:** Republic of the Philippines  

---

## Document Map

| # | File | Document ID | Who must accept | Trigger |
|---|---|---|---|---|
| 1 | [01-universal-account-consent.md](01-universal-account-consent.md) | UAC-1.0 | **Everyone** — guests, hosts, members | Account creation |
| 2 | [02-renter-booking-rules.md](02-renter-booking-rules.md) | RBR-1.0 | Guests / renters | First booking |
| 3 | [03-host-onboarding-agreement.md](03-host-onboarding-agreement.md) | HOA-1.0 | Hosts | Host application |
| 4 | [04-safety-privacy-surveillance.md](04-safety-privacy-surveillance.md) | SPSB-1.0 | Everyone | Account creation |
| 5 | [05-payment-refunds-incidentals.md](05-payment-refunds-incidentals.md) | PRI-1.0 | Guests + hosts | First booking / listing |
| 6 | [06-long-stay-addendum.md](06-long-stay-addendum.md) | LSA-1.0 | Guests + hosts | Any booking ≥ 28 nights |

UAC-1.0 and SPSB-1.0 are accepted at sign-up. All others are accepted at the relevant workflow step (booking, host application, or long-stay confirmation). Accepting a later document implies continued acceptance of all earlier required documents.

---

## Design Principles

- **No duplicate clauses.** Each obligation appears in exactly one document. Cross-references are used where topics overlap.
- **Plain language first.** Every section opens with a *What this means* plain-language summary before any obligation or boundary language.
- **Four-part structure per section.** *What this means → Your obligation → Platform boundary → (Checkbox at document end).*
- **Counsel placeholders.** Every jurisdiction-sensitive area carries a `<!-- COUNSEL: [jurisdiction] — [topic] — [DATE] -->` comment for qualified legal review before publication.

---

## Dependency Graph

```
UAC-1.0  ──────────────────────────┐
                                    ↓ (all require UAC)
SPSB-1.0  ←── everyone at sign-up  │
RBR-1.0   ←── guests               │
HOA-1.0   ←── hosts                │
PRI-1.0   ←── guests + hosts       │
                                    │
LSA-1.0   ←── requires UAC + RBR + PRI  (auto-triggered at ≥ 28 nights)
```

---

## Counsel Review Checklist

Before publishing any document, each `<!-- COUNSEL: ... -->` placeholder must be replaced with a sign-off line in the format:

```
<!-- COUNSEL SIGN-OFF: [Jurisdiction] — reviewed by [Firm / Name] — [Date] — [Notes or "No changes required"] -->
```

Priority order for review:

1. **LSA-1.0** — highest risk (Philippine tenancy-law intersection)
2. **HOA-1.0** — BIR withholding and host-cancellation-penalty enforceability
3. **PRI-1.0** — BSP payment-aggregator registration and refund-timeline compliance
4. **SPSB-1.0** — NPC registration, DPO requirement, cross-border transfer consent
5. **UAC-1.0** — choice-of-law enforceability for Philippine-resident users
6. **RBR-1.0** — RA 7394 consumer-protection disclosures

---

## Update Process

1. Increment the document version (e.g., `1.0.0 → 1.1.0` for material changes).
2. Update the `effective` date to at least **14 days in the future**.
3. Send email + in-app notice to all affected user segments before the effective date.
4. Do not apply changes retroactively to confirmed bookings.
5. Archive the superseded version in `docs/legal/archive/`.
