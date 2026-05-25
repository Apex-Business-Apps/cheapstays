# CheapStays Protection-Naming Guide

## Purpose

This guide governs how CheapStays names every score, badge, record, fee, gate, and attestation that touches guest or host protection. Consistent naming across all surfaces — product, legal, support, and communications — prevents confusion, reduces support volume, and makes our policies easier to enforce.

**A name that appears differently in the UI than in the booking confirmation than in the dispute form is a policy failure, not just a style error.**

---

## The Canonical Names

### Scores

#### Guest Reliability Score
A numeric indicator of a guest's booking behaviour over time. Factors include cancellation history, payment punctuality, property care feedback from hosts, and adherence to house rules.

- Displayed to: hosts (during booking review), guests (on their profile)
- Range: 0–100
- Threshold for standard booking: 60
- Do not call it: Guest Rating, Trust Score, Reliability Index, Guest Stars

#### Host Quality Score
A composite measure of a host's listing accuracy, responsiveness, cleanliness standards, and guest outcomes. Replaces point-in-time star averages.

- Displayed to: guests (on listing pages), hosts (on dashboard)
- Range: 0–100
- Threshold for featured placement: 75
- Do not call it: Host Rating, Superhost Score, Host Stars, Quality Rating

---

### Badges

#### Clean Exit Badge
Awarded to guests who complete a stay with no property damage reports, no rule violations, and no unresolved disputes. Visible on the guest's profile. Helps hosts make faster booking decisions.

- Awarded automatically after dispute window closes (72 hours post-checkout)
- Revoked if a Property Condition Report is upheld after the window
- Do not call it: Checkout Badge, Good Guest Badge, Green Record

---

### Records

#### Care & Conduct Record
The permanent log of a guest's reported rule violations, noise complaints, and property misuse incidents. Hosts can request to view a guest's Care & Conduct Record before accepting a booking request.

- Visible to: hosts (on request), CheapStays Trust team, legal holds
- Entries persist for 36 months from the incident date
- Do not call it: Conduct History, Incident Log, Behaviour Record, Black Mark

#### Property Condition Report
A structured post-stay report filed by a host to document damage, missing items, or excessive mess beyond normal wear and tear. Initiates the review and compensation process.

- Must be filed within 24 hours of guest checkout
- Requires photo evidence and itemised description
- Triggers automatic hold on guest's Clean Exit Badge until resolved
- Do not call it: Damage Report, Inspection Report, Host Complaint

---

### Fees

#### Lost Access Fee
The charge applied when a guest fails to return keys, access cards, or codes at checkout, or causes a lock replacement to be necessary. Covers locksmith costs, replacement hardware, and one night's lost bookings during remediation.

- Default amount: set per-listing by host, subject to platform maximum ($250)
- Billed to the payment method on file
- Guests receive 48 hours to return access items before the fee is applied
- Do not call it: Lockout Fee, Key Penalty, Access Replacement Charge

---

### Gates and Flows

#### LegalScrollGate
The UI checkpoint that requires a user to scroll to the bottom of a legal document before the acceptance button activates. Used for Terms of Service updates, policy changes, and any document that carries legal weight.

- Implemented as a scroll-progress listener on the document container
- Acceptance button state: disabled (grey) until 100% scroll depth reached
- Logs: user ID, document version, timestamp, IP address
- Do not call it: Legal Scroll, Consent Wall, Terms Gate, Scroll Lock

---

### Bundles and Sections

#### Safety, Privacy & Surveillance Bundle
The grouped set of host disclosures required for any listing that includes security cameras, smart locks, noise monitors, or other recording or monitoring devices. Hosts must complete this bundle before a listing goes live or remains active.

- Consists of three required disclosures:
  1. Device type and location
  2. Recording scope (audio, video, motion-only)
  3. Data retention and access policy
- Incomplete bundles block listing activation
- Do not call it: Camera Policy, Surveillance Disclosure, Monitoring Pack, Safety Pack

#### Digital Amenity Safety subsection
The portion of a listing's safety information covering connected devices offered to guests: smart TVs, streaming accounts, shared tablets, printers, smart speakers. Hosts must describe any account sharing, usage limits, and data wiping procedures.

- Part of the main listing setup flow, under the Safety tab
- Required if any digital amenity is listed in property features
- Do not call it: Wi-Fi Safety, Device Policy, Tech Safety, Smart Home Section

---

### Declarations and Attestations

#### Property Authority Declaration
The host's signed confirmation that they have the legal right to list the property — whether as owner, long-term tenant, or authorised property manager — and that listing does not violate any lease, HOA rule, or local regulation.

- Required at account creation and on any new listing
- Re-attestation triggered by: address change, ownership change, platform audit flag
- Do not call it: Ownership Declaration, Host Authority Form, Property Rights Form

#### Fire & Life Safety Attestation
The host's signed confirmation that the property meets the minimum fire and life safety requirements: working smoke detectors, carbon monoxide detector (where required by law), unobstructed emergency exits, and a visible emergency contact card.

- Required on every listing before first booking
- Annual renewal required
- Triggers a listing pause if overdue by more than 14 days
- Do not call it: Fire Safety Declaration, Safety Certificate, Life Safety Form

---

## Enforcement

### Who Owns These Names

The Product team owns canonical names. Any proposed rename requires sign-off from Product, Legal, and Support before implementation.

### How to Raise a Conflict

If you encounter a name inconsistency — in code, copy, a support macro, or an external-facing document — file an issue tagged `brand:naming`. Do not unilaterally rename a canonical term to fix a local inconsistency.

### Audit Cadence

Naming compliance is reviewed quarterly. The Brand team maintains a search index against all UI strings, email templates, legal documents, and support scripts. Deviations are flagged for correction in the next sprint.

---

## Quick-Reference Table

| Canonical Name | Type | Who Sees It |
|---|---|---|
| Guest Reliability Score | Score | Guests, Hosts |
| Host Quality Score | Score | Guests, Hosts |
| Clean Exit Badge | Badge | Guests, Hosts |
| Care & Conduct Record | Record | Hosts (on request), Trust Team |
| Property Condition Report | Record | Hosts, Guests (if disputed), Trust Team |
| Lost Access Fee | Fee | Guests, Hosts |
| LegalScrollGate | UI Gate | Internal (product/eng) |
| Safety, Privacy & Surveillance Bundle | Disclosure Set | Hosts |
| Property Authority Declaration | Attestation | Hosts, Legal |
| Fire & Life Safety Attestation | Attestation | Hosts, Legal |
| Digital Amenity Safety subsection | Listing Section | Hosts |
