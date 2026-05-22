---
title: "Payment, Refunds & Incidentals"
document-id: PRI-1.0
version: "1.0.0"
effective: "2026-05-22"
jurisdictions: "Republic of the Philippines"
requires: "UAC-1.0 (Universal Account Consent)"
operator: "APEX Business Systems Ltd., Edmonton, AB, Canada"
platform: "CheapStays (cheapstays.me)"
payment-processor: "PayMongo (BSP-regulated)"
currency: "Philippine Peso (PHP ₱)"
---

<!-- COUNSEL: Philippines — review against BSP Circular 1048 (e-payment regulations), RA 8792 (E-Commerce Act), RA 7653 (BSP Charter), RA 7394 (Consumer Act) refund-timeline obligations, and PayMongo merchant-agreement requirements for APEX — [DATE] -->
<!-- COUNSEL: Philippines — assess whether CheapStays as a marketplace is required to register as a payment aggregator or facilitator under BSP rules — [DATE] -->
<!-- COUNSEL: Alberta — confirm whether APEX's facilitation of PHP-denominated transactions triggers FINTRAC / PCMLTFA reporting obligations — [DATE] -->

---

## Plain-Language Summary

All prices on CheapStays are in Philippine Pesos (₱). Payments flow through PayMongo — a BSP-regulated Philippine processor — and support GCash, Maya, debit/credit cards, and bank transfer. CheapStays calculates the booking total on its own servers so no one can manipulate the amount. Refunds follow the cancellation policy displayed on each listing. Damage claims must be filed within 48 hours of check-out with supporting evidence.

---

## 1. Pricing & Currency

### What this means
Every listing shows a nightly rate and a total price. What you see at checkout is what you pay.

### Your obligation
- Review the total shown at checkout (nightly rate × nights + any stated charges) before confirming.
- Understand that your bank or card issuer may apply foreign-exchange or cross-border fees if you are paying from a non-Philippine account — these are outside CheapStays' control.

### Platform boundary
- All prices are displayed and charged in Philippine Pesos (PHP / ₱).
- The booking total is computed server-side from database values (nightly rate × nights). The client cannot submit or override the amount.
- CheapStays does not add fees beyond the platform fee disclosed at checkout.

---

## 2. Accepted Payment Methods

### What this means
You can pay by several methods, all processed by PayMongo.

| Method | Notes |
|---|---|
| GCash | Instant e-wallet debit |
| Maya (PayMaya) | Instant e-wallet debit |
| Credit / Debit Card | Visa, Mastercard; 3DS authentication required |
| Bank Transfer | Subject to bank processing time |
| Cash | Available only on listings where the host has enabled this option |

### Your obligation
- Use only payment methods you are authorised to use.
- Complete any 3DS authentication step required by your card issuer.
- Do not initiate a chargeback before first raising a dispute through the CheapStays support system (see Section 7).

### Platform boundary
CheapStays does not store card numbers, CVVs, or full bank-account details. Only the PayMongo payment-intent ID is retained. Payment processing is performed entirely by PayMongo; CheapStays has no access to your raw card data.

---

## 3. When You Are Charged

### What this means
Your payment is initiated at booking confirmation, but the flow differs for instant-book versus request-to-book listings.

### Your obligation
- Ensure sufficient funds are available at the time of booking confirmation.
- Do not cancel and rebook to exploit price changes or booking-window anomalies.

### Platform boundary
- **Instant-book listings** — payment is initiated and completed at the moment you confirm.
- **Request-to-book listings** — a payment intent is created but the charge completes only when the host confirms. If the host does not confirm within the request window, the intent is voided and no charge is applied.
- **Demo mode** (PayMongo not yet configured) — bookings are confirmed at ₱0 for testing; no money moves.

---

## 4. Cancellation & Refund Policy

### What this means
Refund eligibility depends on the cancellation tier attached to each listing. Three standard tiers exist; hosts may define a custom policy instead.

| Tier | Refund eligibility |
|---|---|
| **Flexible** | Full refund if cancelled ≥ 24 hours before check-in |
| **Moderate** | Full refund if cancelled ≥ 5 days before check-in |
| **Strict** | 50% refund if cancelled ≥ 7 days before check-in; no refund within 7 days |

### Your obligation
- Check the cancellation policy on the listing page before booking.
- Cancel through the CheapStays platform before the relevant deadline.
- Contact **cheapstays.me@gmail.com** within **24 hours of check-in** to report a material discrepancy that you believe entitles you to an out-of-policy refund.

### Platform boundary
- The CheapStays platform fee is non-refundable in all cases, except where a platform error caused the booking to fail.
- Refunds are returned to the original payment method: **3–7 business days** for card payments; typically same-day or instant for GCash and Maya.
- Host-set custom cancellation policies are displayed at checkout and override the standard tiers above.

<!-- COUNSEL: Philippines — confirm whether RA 7394 mandates specific minimum refund timelines for accommodation services — [DATE] -->

---

## 5. No-Show Policy

### What this means
If you do not arrive and do not cancel, you forfeit the full booking amount.

### Your obligation
- Cancel before check-in time if you cannot travel.
- A no-show is recorded in the system and is not eligible for a refund.

### Platform boundary
CheapStays will not override the no-show policy except in documented force-majeure situations (declared natural disaster, government travel ban, or medical emergency with contemporaneous evidence). Contact support within **48 hours** of the missed check-in with documentation.

---

## 6. Damage & Incidentals

### What this means
Normal use is expected. Damage beyond ordinary wear and tear is the guest's financial responsibility.

### Your obligation — guests
- Report any damage to the host and to CheapStays support within **24 hours of check-out**.
- Cooperate with the assessment process. If fault is confirmed, pay the documented cost of repair or replacement.

### Your obligation — hosts
- File a damage claim within **48 hours of check-out**.
- Provide: timestamped photographic evidence, itemised repair or replacement costs, and receipts where available.
- Claims filed more than 48 hours after check-out may not be actioned.

### Platform boundary
- CheapStays mediates damage claims but does not guarantee recovery for either party.
- CheapStays does not hold a default security deposit. Hosts who wish to collect a deposit must state this clearly in the listing and collect it via a separate arrangement — CheapStays is not a party to off-platform deposit arrangements.
- Normal wear and tear (minor scuffs, routine cleaning) does not constitute a damage claim.

<!-- COUNSEL: Philippines — assess whether off-platform host deposit arrangements require separate BSP or consumer-protection disclosures; confirm CheapStays' liability exposure for such arrangements — [DATE] -->

---

## 7. Chargebacks & Payment Disputes

### What this means
A chargeback is when you ask your bank to reverse a charge directly. We ask that you come to us first — it is faster and fairer.

### Your obligation
- Before filing a chargeback with your bank or card issuer, submit a dispute through **cheapstays.me@gmail.com** and allow us **72 hours** to respond.
- Filing a fraudulent chargeback (where you received the accommodation and are attempting a free stay) is a breach of these terms, may result in account suspension, and may be pursued through civil or criminal action.

### Platform boundary
CheapStays will represent its position in any chargeback investigation with PayMongo. We reserve the right to recover losses from fraudulent chargebacks through legal means.

---

## Checkbox Text

> ☐ **I have read and agree to the Payment, Refunds & Incidentals terms.** I understand that all prices are in Philippine Pesos, payment is processed by PayMongo, refunds follow the cancellation policy shown on each listing, and damage must be reported within 24 hours of check-out.
