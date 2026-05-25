# Support Standard Operating Procedure

**Organization:** APEX Business Systems Ltd.
**Location:** Edmonton, AB
**Document Version:** 1.0.0
**Classification:** Internal — Support Operations
**Last Updated:** 2026-05-22
**Next Review:** 2026-08-22

---

## 1. Purpose and Scope

This SOP governs how CheapStays support staff receive, triage, resolve, and close user tickets. It applies to all agents handling the `support_tickets` and `support_messages` queues.

CheapStays is a short-term rental discovery and booking platform. Support's role is to resolve platform issues — account, booking, payment, listing, and review problems — within the boundaries of what the platform can do.

**CheapStays is not and does not act as:**
- A police or law enforcement agency
- A court or arbitration body
- An emergency responder
- An insurer or compensation guarantor
- A landlord, property manager, or building manager

When a user's issue falls outside platform authority, the correct action is to clearly say so and direct the user to the right channel — not to absorb the problem or make promises the platform cannot keep.

---

## 2. Support Tiers

| Tier | Handler | Scope |
|------|---------|-------|
| **Tier 0** | AI assistant (automated) | Informational queries, how-to questions, minor account lookups — no data mutations |
| **Tier 1** | Support agent | Standard booking, payment, account, listing, and review issues resolved by checklist gate |
| **Tier 2** | Senior support / operations lead | Escalated disputes, ambiguous cases, high-value booking issues, pattern of complaints |
| **Tier 3** | Legal / executive | Formal legal requests, law enforcement cooperation, regulatory matters, fraud at scale |

Tickets are routed automatically to Tier 1. Tickets containing the escalation keywords (`refund`, `fraud`, `chargeback`, `scam`, `legal`, `lawsuit`, `stolen`, `urgent`) are flagged for human review and bypass AI handling.

---

## 3. First-Response Standards

| Ticket Type | First Response Target |
|-------------|----------------------|
| Standard (Tier 1) | Within 1 business day |
| Escalated / flagged | Within 4 business hours |
| Safety concern (imminent) | Immediately acknowledge; direct to emergency services if life or safety at risk |

The first response must:
1. Acknowledge the ticket number and subject.
2. Confirm what CheapStays can and cannot do for the situation.
3. State the next step (information needed, action being taken, or referral).

Do not make promises about outcomes, refunds, or timelines that have not been approved.

---

## 4. Standard Resolution Gates

Most Tier 1 cases are resolved by a checklist. Work through each gate in order. Close or escalate based on the outcome.

### 4.1 Identity and Ownership Gate

Before taking any account or booking action, confirm:

- [ ] Ticket submitter is authenticated (JWT-verified session; system-enforced)
- [ ] The booking, listing, or account referenced belongs to the submitter, or the submitter is an authorized party (host on the relevant listing, admin)
- [ ] If a third party is referenced (e.g., "a host did X to me"), confirm the submitter's role in the transaction

**Fail:** Do not proceed. Request correct credentials or clarify the relationship. Do not disclose another user's data to an unauthorized party.

### 4.2 Booking Status Gate

For any booking-related issue:

- [ ] Retrieve `bookings` record: `status`, `payment_status`, `payment_method`, `check_in`, `check_out`
- [ ] Confirm whether the stay has occurred, is upcoming, or is in progress
- [ ] Confirm payment state: `unpaid`, `pending`, `paid`, `failed`, or `refunded`

**Fail:** If booking record does not match user's claim, document the discrepancy and request clarification before proceeding.

### 4.3 Payment Gate (for refund or payment disputes)

- [ ] Confirm `payment_status = 'paid'` before discussing any refund
- [ ] Confirm the `paymongo_payment_intent_id` is present and the payment was not already `refunded`
- [ ] Verify the cancellation reason and whether it falls under the host's stated cancellation policy
- [ ] Confirm the cancellation was initiated before or after check-in

**Fail:** If payment was not completed (`failed`, `unpaid`), no refund is applicable. If already `refunded`, confirm and close.

**Note:** CheapStays does not guarantee refunds. Refund eligibility is governed by the host's cancellation policy at the time of booking. Disputes with a payment provider (PayMongo / GCash / Maya / card issuer) must be directed to that provider's dispute process.

### 4.4 Listing and Host Gate (for listing complaints)

- [ ] Confirm the listing is active and owned by the referenced host
- [ ] Check if the guest completed a stay at the listing (booking `status = 'completed'`)
- [ ] Review any existing reviews on the listing for pattern

**Fail:** If the guest never booked or stayed at the listing, platform mediation does not apply.

### 4.5 Review Gate (for review disputes)

- [ ] Confirm the review was submitted by a user with a `completed` booking at the listing
- [ ] Confirm the review has not been previously actioned
- [ ] Assess whether the dispute is factual (verifiable against booking records) or subjective (opinion, rating)

**Fail — factual dispute:** If the review contains demonstrably false factual claims (e.g., dates that contradict booking records), escalate to Tier 2 for review action.

**Fail — subjective dispute:** Inform the user that subjective opinions and ratings are not removed unless they violate platform policies. Close at Tier 1.

---

## 5. Escalation Criteria

Escalate to Tier 2 when **any** of the following are true:

- The user has described a criminal act (theft, assault, fraud, illegal surveillance, cyber abuse)
- The dispute involves PHP 10,000 or more
- The user has submitted more than two prior tickets about the same booking or incident
- The facts are contradicted by platform records and the discrepancy is unresolved
- The user has indicated they intend to pursue legal action
- The case involves a host with three or more complaints in 90 days
- The review or message contains content that may violate law (CSAM referral required immediately; do not describe or retain content — escalate to Tier 3 immediately)

---

## 6. Escalation Language

Use these approved templates when escalating. Do not improvise language that implies platform liability or capability beyond what is stated.

### 6a. Escalation to Tier 2

> "Thank you for the detail you've provided. This ticket has been escalated to our senior support team for review. You'll hear from us within [timeframe]. Please do not submit additional tickets on the same matter — they will be linked to this one."

### 6b. Crime, Assault, or Safety — Refer to Authorities First

> "If you are describing a crime or situation involving physical harm, please contact local emergency services (911 in Canada / 911 or 117 in the Philippines) or the appropriate local police authority immediately if you have not already done so. CheapStays is a booking platform and is not equipped to respond to emergencies or conduct criminal investigations. Once you have made a report with the appropriate authority, please return to this ticket with any case or report number — we will preserve relevant platform records and cooperate with authorized requests through the proper legal process."

### 6c. Illegal Surveillance or Cyber Abuse

> "If you believe you have been subjected to illegal surveillance (e.g., hidden cameras) or cyber abuse, please report this to the relevant law enforcement agency immediately — in the Philippines, the National Bureau of Investigation (NBI) Cybercrime Division or the Philippine National Police (PNP) Anti-Cybercrime Group; in Canada, your local police service and the Canadian Anti-Fraud Centre. CheapStays takes these reports seriously. We will preserve platform records related to this case and respond to authorized legal requests. Please provide an incident or case number once you have one."

### 6d. Legal Process / Subpoena Request

> "CheapStays preserves platform records and cooperates with law enforcement and legal authorities through the proper legal process. To request platform data, please submit a valid legal order (subpoena, court order, or equivalent instrument) to legal@apexbusinesssystems.ca. We do not release user data outside of a formal legal process."

### 6e. Emergency — Refer to Building/Property Plan

> "For building emergencies (fire, flood, structural concern, power outage), please follow the emergency procedures provided by the property or building management. CheapStays is a booking platform and does not manage properties or buildings directly. If you do not have access to the property's emergency contact, please contact local emergency services."

### 6f. Insurance / Compensation Claim

> "CheapStays does not provide insurance or compensation for property damage, personal injury, or lost items. For these matters, please contact your travel insurer, the host's property insurer if applicable, or the appropriate local authority. We can provide a record of your booking for documentation purposes on request."

---

## 7. Closure Standards

A ticket may be closed when:

- [ ] The issue was resolved (action taken, information provided, or referral made)
- [ ] The user has been notified of the resolution or next step
- [ ] All gates applicable to the case were completed and documented

**Do not close a ticket that has been escalated to Tier 2 or 3 without Tier 2/3 sign-off.**

---

## 8. Record Preservation

When a ticket involves a dispute, legal concern, crime report, or escalation:

- Do not delete or modify any support messages, booking records, or user data related to the case
- Flag the ticket as `escalated` in the platform
- Note the preservation date and the reason in an internal note on the ticket

CheapStays cooperates with authorized legal requests. See `/docs/support/evidence-standards.md` for the full evidence and legal process standard.

---

## 9. What We Do / Do Not Do — Quick Reference

| We do | We do not |
|-------|-----------|
| Provide booking confirmation records | Investigate crimes or conduct evidence collection |
| Resolve platform-level payment and booking errors | Guarantee refunds beyond the host's cancellation policy |
| Remove listings or suspend accounts per platform policy | Act as police, insurer, landlord, or building manager |
| Preserve records for legal process | Release data without valid legal process |
| Refer users to authorities for crime/safety issues | Respond to emergencies or dispatch responders |
| Escalate flagged review content per platform policy | Adjudicate subjective disputes about stay quality |
| Cooperate with lawful legal orders | Provide legal advice |

---

*See also: [`incident-matrix.md`](./incident-matrix.md) | [`evidence-standards.md`](./evidence-standards.md)*
