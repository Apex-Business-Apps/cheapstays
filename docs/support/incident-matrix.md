# Incident Matrix

**Organization:** JGP Corporation
**Location:** Pasig City, Metro Manila, Philippines
**Document Version:** 1.0.0
**Classification:** Internal — Support Operations
**Last Updated:** 2026-05-22
**Next Review:** 2026-08-22

---

## How to Use This Matrix

1. Identify the incident category and row.
2. Work through the **Gate** column as a checklist — each item is pass/fail.
3. If all gates pass, take the **Routine Action**.
4. If any gate fails or a **Mandatory Escalation Trigger** is present, follow the **Escalation / Referral** column.
5. Use the **Tier** column to route correctly. Tier 1 = agent can close. Tier 2 = senior review required. Tier 3 = legal/executive.

**Legend:**
- Gate items marked `[R]` are required; a fail at an `[R]` gate stops processing.
- `→ Auth` means refer to authorities first before platform action.
- `→ T2` / `→ T3` means escalate internally.

---

## Section A — Account Issues

### A1. Cannot Log In / Account Access

**Tier:** 1
**Routine Action:** Direct user to password reset / magic link flow; confirm email address is valid in platform.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Submitter is the account owner (or authorized representative) | Continue | Request identity verification; do not take action on unverified request |
| Account exists in platform | Assist with access recovery | Inform user account was not found; do not confirm or deny other accounts |
| No suspicious recent access in `role_audit_log` | Close at T1 | → T2: flag potential unauthorized access |

**Mandatory Escalation Trigger:** User reports account was accessed without their permission → → T2 immediately; preserve session and role audit records.

---

### A2. Account Suspension or Role Removal

**Tier:** 1 / 2
**Routine Action:** Confirm the role change in `role_audit_log` and state the reason if documented.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Submitter is the account holder | Continue | Do not discuss another user's account status |
| Role change is documented in `role_audit_log` | Inform user of action date and actor | → T2: investigate undocumented change |
| User has been notified per platform policy | Close at T1 | → T2: ensure notification gap is documented |

**Mandatory Escalation Trigger:** User claims role was removed without cause and has active bookings as host → → T2.

---

### A3. Duplicate or Merged Accounts

**Tier:** 2
**Routine Action:** Identify both account UUIDs; confirm booking and review ownership; document in ticket. Route to T2 for resolution — do not merge or delete accounts at T1.

---

## Section B — Booking Issues

### B1. Guest Cannot Complete Booking

**Tier:** 1
**Routine Action:** Confirm listing status is `active`; confirm dates are available; confirm payment method is supported.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Listing exists and is active | Continue | Inform guest listing is unavailable; close |
| Dates are not blocked in availability | Continue | Inform dates unavailable |
| Payment method is accepted (GCash, Maya, card) | Continue | Direct to supported payment options |
| Guest has confirmed booking in DB | Close — provide booking number | → T2: booking failed despite payment attempt |

**Mandatory Escalation Trigger:** Payment was charged but booking is not confirmed → → T2 immediately; do not close.

---

### B2. Host Did Not Confirm / Booking Stuck in Pending

**Tier:** 1 / 2
**Routine Action:** Confirm booking `status = 'pending'`; check age of pending booking; notify host via platform message if within policy window.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Booking exists and belongs to the submitter | Continue | Identity gate fail; do not proceed |
| Booking is `pending` (not cancelled or confirmed) | Continue | Inform guest of current status; close or assist |
| Pending duration is within policy | Advise guest to await host response | → T2 if pending > 48 hours with no host response |
| Payment is not yet charged | Continue | → T2: payment charged on unconfirmed booking |

---

### B3. Cancellation Request

**Tier:** 1
**Routine Action:** Confirm booking status and cancellation eligibility per host's policy. Update `status = 'cancelled'` if eligible and within policy.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Booking belongs to submitter | Continue | Identity gate fail |
| Booking `status` is `pending` or `confirmed` (not `completed` or `cancelled`) | Continue | Cannot cancel a completed or already-cancelled booking |
| Cancellation requested before check-in date | Eligible per policy | After check-in: refund eligibility reduced or none |
| Host's cancellation policy permits refund | Inform guest of refund amount | Inform guest refund is not available per policy; close |

**Note:** CheapStays does not override host cancellation policies. Guests may dispute directly with their payment provider. CheapStays does not mediate disputes between a guest and their card/e-wallet issuer.

---

### B4. Host Cancelled a Confirmed Booking

**Tier:** 2
**Routine Action:** Confirm booking record; confirm host initiated cancellation after confirmation. → T2 to review host account and flag for policy review.

**Mandatory Escalation Trigger:** Host cancelled within 48 hours of check-in, or has cancelled two or more bookings in 60 days → → T2; flag host profile for review.

---

### B5. Guest Did Not Show (No-Show)

**Tier:** 1
**Routine Action:** Confirm `status = 'no_show'` is set by host. Inform guest of no-show status and applicable policy. Refund eligibility is per host's policy; CheapStays does not override.

---

### B6. Booking Dispute — Stay Already Occurred

**Tier:** 2
**Routine Action:** All disputes about a completed stay require T2 review. Do not promise any outcome at T1.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Booking `status = 'completed'` | Continue | If stay not completed, categorize under B3 or B5 |
| `[R]` Submitter was the guest or host on the booking | Continue | Identity gate fail |
| Dispute is about a platform-verifiable fact (dates, payment, booking record) | → T2 with record pull | Dispute is about subjective stay quality → inform user this is outside platform resolution; review policy applies |

**Note:** CheapStays does not adjudicate disputes about stay quality, cleanliness, host behavior, or amenity condition. These are matters for the guest's review (visible on the listing) and, if a crime is involved, for the relevant authorities.

---

## Section C — Payment Issues

### C1. Payment Failed

**Tier:** 1
**Routine Action:** Confirm `payment_status = 'failed'`; advise user to retry with a supported method or contact their payment provider.

| Gate | Pass | Fail |
|------|------|------|
| Payment status is `failed` (not `pending` or `paid`) | Advise retry | → T2 if status is ambiguous or booking is in a bad state |
| Booking was not confirmed | No money movement; close | → T2 if booking was confirmed despite failed payment |

---

### C2. Refund Request

**Tier:** 1 / 2

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Payment `status = 'paid'` | Continue | Refund not applicable; close |
| `[R]` Payment not already `refunded` | Continue | Confirm refund was processed; close |
| Cancellation was before check-in | Policy-eligible refund window; → T2 to initiate | Post-check-in: host's policy governs; likely not eligible |
| Host's cancellation policy supports refund | → T2 to initiate refund via PayMongo | Inform guest policy does not support refund; escalation option available |

**Mandatory Escalation Trigger:** Guest claims they were charged but have no booking record → → T2 immediately; pull PayMongo intent ID and booking records.

**Note:** CheapStays does not guarantee refunds. Refund decisions are governed by the host's cancellation policy applied at booking. CheapStays does not act as an insurer.

---

### C3. Suspected Fraudulent Charge

**Tier:** 2 / 3

**Immediate action:** → T2 on receipt. Do not close at T1.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Submitter's identity is confirmed | Continue | Do not proceed; request verification |
| Platform booking record matches the charge | Document; → T2 | No matching record: possible payment processor fraud → → T3; advise user to contact PayMongo and their bank |
| Charge originated from platform (PayMongo intent ID present) | → T2 to investigate | No platform origin: outside platform scope; refer to payment provider |

**Authority Referral:** If the user believes their payment credentials were stolen or misused by a third party, direct them to their bank or e-wallet provider (GCash/Maya) and, if appropriate, the NBI Cybercrime Division or local police. CheapStays cooperates with authorized legal requests.

---

## Section D — Listing Issues

### D1. Listing Not Appearing in Search

**Tier:** 1
**Routine Action:** Confirm listing `status = 'active'` and required fields are complete (price, address, images, description).

---

### D2. Listing Content Complaint (Inaccurate Description)

**Tier:** 1 / 2

| Gate | Pass | Fail |
|------|------|------|
| Submitter has a `completed` booking at the listing | Complaint is reviewable | Submitter never stayed → listing dispute is not actionable via support; direct to review system |
| Claimed inaccuracy is factual (verifiable) | → T2 to review listing | Claimed inaccuracy is subjective (opinion) → direct to review; close at T1 |

---

### D3. Listing Policy Violation (Prohibited Content / Illegal Activity)

**Tier:** 2 / 3

**Immediate action:** → T2 on receipt. Do not close at T1. If content involves CSAM or imminent harm, → T3 immediately.

| Gate | Pass | Fail |
|------|------|------|
| Complaint identifies specific listing (ID or URL) | Listing can be reviewed | Request the listing reference; hold ticket open |
| Content violates platform policy | → T2 to suspend listing pending review | Content is potentially illegal → → T3; preserve listing record |

---

## Section E — Review Issues

### E1. Guest Requests Review Removal — Factual Dispute

**Tier:** 2
**Routine Action:** → T2. Reviews are not removed at T1.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Review was submitted by a user with a `completed` booking | Review is valid on its face | Review by non-guest: → T2 to investigate eligibility |
| Claimed factual error is verifiable against booking records (dates, payment) | → T2 with records | Dispute is about quality or opinion → inform host that subjective reviews are not removed; close at T1 |

---

### E2. Guest Requests Review Removal — Subjective Dispute

**Tier:** 1
**Routine Action:** Inform the host that ratings and opinions expressed in reviews by verified guests are not removed based on host disagreement. The host may post a public reply. Close at T1.

---

### E3. Review Contains Personal Attacks or Policy-Violating Content

**Tier:** 2
**Routine Action:** → T2 to assess against platform content policy. Do not remove at T1.

---

## Section F — Safety and Harm Reports

### F1. Guest Reports Safety Hazard at Property

**Tier:** 2

**First response (T1):** Acknowledge; issue the building/emergency referral:

> "For any immediate safety hazard, please follow the emergency procedures provided by the property or building. If there is imminent danger, contact local emergency services immediately. CheapStays does not manage properties and cannot dispatch assistance."

Then → T2 to review and flag the listing.

| Gate | Pass | Fail |
|------|------|------|
| `[R]` Submitter has a booking at the property | Continue | Cannot verify stay; still flag listing for T2 review |
| Hazard is ongoing and imminent | Refer to emergency services; → T2 | Past hazard: document; → T2 |
| Listing has prior safety complaints | → T2 with escalation flag | First complaint: → T2 standard review |

---

### F2. Assault, Harassment, or Threat

**Tier:** 2 / 3
**Immediate action:** Issue authority referral immediately. Do not attempt to investigate or mediate.

> "If you have experienced or witnessed assault, harassment, or threats, please contact local emergency services or the police immediately if you have not already done so. In the Philippines: 911 or PNP hotline 117. In Canada: 911 or your local police service. CheapStays cannot investigate or respond to criminal matters. Once you have filed a report, please share the incident or case number with us — we will preserve relevant platform records and cooperate with authorized legal requests."

→ T3. Preserve all records related to the booking and parties.

---

### F3. Suspected Hidden Camera / Illegal Surveillance

**Tier:** 3
**Immediate action:** Issue authority referral immediately. → T3. Preserve all platform records.

> "If you believe you have been subjected to illegal surveillance, please contact local law enforcement immediately. In the Philippines: NBI Cybercrime Division or PNP Anti-Cybercrime Group. In Canada: your local police service. This is a criminal matter that must be reported to and investigated by the appropriate authority. CheapStays does not conduct surveillance investigations. We will preserve all platform records relating to this case and respond to authorized legal requests."

**Do not instruct the user to touch or remove any suspected device** — that is for law enforcement to advise.

---

### F4. Cyber Abuse / Doxxing / Online Harassment by Another User

**Tier:** 3
**Immediate action:** Issue authority referral immediately. → T3.

> "If you are being subjected to cyber abuse or online harassment, please report this to the relevant authority. In the Philippines: NBI Cybercrime Division or PNP Anti-Cybercrime Group. In Canada: your local police service and the Canadian Anti-Fraud Centre. CheapStays will preserve any relevant platform records and cooperate with authorized legal requests."

Suspend messaging privileges of the reported account pending T3 review if content is on-platform and documented.

---

## Section G — Fraud and Scam Reports

### G1. User Reports Scam Listing

**Tier:** 2 / 3

| Gate | Pass | Fail |
|------|------|------|
| Listing ID is provided | Review listing record | Request listing reference; hold |
| User paid through the platform | → T2 to investigate payment and listing | User paid outside platform: outside platform scope; advise to contact bank and authorities |
| Listing host account shows pattern (multiple reports) | → T3; preserve host account | First report: → T2 standard review |

**Authority Referral:** If the user paid money outside the CheapStays platform and believes they were scammed, direct them to their bank, e-wallet provider, and local police or the NBI. CheapStays cannot recover funds from off-platform transactions.

---

### G2. User Reports Identity Fraud / Impersonation

**Tier:** 3
**Immediate action:** → T3. Issue authority referral.

> "Identity fraud is a criminal matter. Please report this to local police or, in the Philippines, the NBI. CheapStays will preserve relevant account records and cooperate with an authorized legal request."

---

## Section H — Legal and Regulatory Requests

### H1. Law Enforcement Data Request

**Tier:** 3
**Routine Action:** Do not disclose any data at T1 or T2. Route to legal@apexbusinesssystems.ca.

> "CheapStays cooperates with law enforcement through the proper legal process. Please submit a valid legal order (subpoena, court order, or equivalent) to legal@apexbusinesssystems.ca."

**Mandatory Escalation Trigger:** Any contact from law enforcement, regardless of channel → → T3 immediately.

---

### H2. User Threatens Legal Action

**Tier:** 2
**Routine Action:** Acknowledge the ticket; do not admit liability; do not make commitments. Issue the standard language and → T2.

> "Thank you for raising this matter. This ticket has been escalated to our senior team. A member of our team will follow up with you. Please do not submit additional tickets on the same matter."

→ T2 to review facts and involve legal if warranted.

---

### H3. Regulatory or Government Inquiry

**Tier:** 3
**Immediate action:** → T3 immediately. Do not respond to the inquiry at T1 or T2.

---

*See also: [`support-sop.md`](./support-sop.md) | [`evidence-standards.md`](./evidence-standards.md)*
