---
title: "Safety, Privacy & Surveillance Bundle"
document-id: SPSB-1.0
version: "1.0.0"
effective: "2026-05-22"
jurisdictions: "Republic of the Philippines"
requires: "UAC-1.0 (Universal Account Consent)"
operator: "JGP Corporation, Pasig City, Metro Manila, Philippines"
platform: "CheapStays (cheapstays.me)"
---

<!-- COUNSEL: Philippines — review against RA 10173 (Data Privacy Act) and NPC Circular 16-01; confirm consent model for cross-border data transfers to Supabase (US/EU infrastructure) and Cloudflare CDN — [DATE] -->
<!-- COUNSEL: Philippines — review against RA 10173 (Data Privacy Act 2012), NPC Circular 16-01 (Security of Personal Information), RA 4200 (Anti-Wiretapping Act), RA 9995 (Anti-Photo and Video Voyeurism Act); confirm NPC registration obligation and Data Protection Officer requirement — [DATE] -->
<!-- COUNSEL: EU/EEA — assess GDPR applicability for EU-resident users of a Philippine-property platform; determine whether data-processor agreements are required with Supabase and Cloudflare — [DATE] -->

---

## Plain-Language Summary

This document covers three linked topics: **(A) Privacy** — what personal data CheapStays collects and how we use it; **(B) Surveillance** — what cameras and recording are allowed at properties; and **(C) Digital Safety** — how to stay safe on our platform. We collect only what we need to operate. We never sell your data. Hidden cameras at listed properties are an absolute ban.

---

## PART A — Privacy

### 1. What Data We Collect

#### What this means
We collect the minimum data needed to run the platform.

| Category | Examples | Why we collect it |
|---|---|---|
| Account identity | Email address, display name | Authentication and communication |
| Profile | Avatar URL, bio, city | Displaying your public profile |
| Booking data | Dates, listing reference, payment reference, guest count | Fulfilling reservations |
| Payment reference | PayMongo intent ID only — no card numbers stored | Payment verification and records |
| Host verification | Government ID photo URL, selfie URL | Identity verification (photos stored, not processed for biometrics) |
| Support interactions | Ticket content, message text | Resolving issues |
| AI concierge | Conversation text (capped 2,000–4,000 chars per message) | Generating AI responses |
| Device/access | IP address, browser type, request timestamps | Security, rate limiting, fraud prevention |

#### Your obligation
Provide accurate data. If your email address or contact details change, update your account.

#### Platform boundary
CheapStays does **not** collect: full card numbers, CVV codes, government ID numbers (only the photo URL), precise GPS location (only city/province level), or browsing activity outside the CheapStays platform.

---

### 2. How We Use Your Data

#### What this means
Your data is used to operate and secure the platform — nothing more.

#### Your obligation
By creating an account you consent to the following uses:
- **Service delivery** — showing your bookings, profile, and listings.
- **Authentication** — verifying your identity per session.
- **Communication** — booking confirmations, support replies, and important notices.
- **Safety and fraud prevention** — rate limiting, anomaly detection, escalation-keyword scanning in support tickets.
- **AI features** — passing your messages to Groq's LLM to generate concierge responses (see Section 5).

We do **not** use your data for:
- Third-party advertising or data brokering.
- Selling or sharing with parties beyond what is necessary to operate the service.
- Automated decisions with legal or similarly significant effects on you, without human review.

#### Platform boundary
CheapStays is the data controller. Infrastructure providers (Supabase, Cloudflare) are data processors operating under contract. The AI inference provider (Groq) receives conversation text only — it does not receive your name, email, or identity details.

---

### 3. Third-Party Data Sharing

#### What this means
We share only what each party needs to do its job.

| Party | What they receive | Purpose |
|---|---|---|
| Supabase | All platform data (hosted database + auth) | Backend infrastructure |
| Cloudflare | Request metadata, cached assets | CDN, DDoS protection |
| PayMongo | Booking amount, payment method type | Payment processing (Philippines) |
| Groq | Conversation text only | AI concierge inference |

No other third parties receive your personal data. CheapStays does not use advertising SDKs, Google Analytics, or social-media tracking pixels.

#### Platform boundary
CheapStays contracts with each provider under data-processing terms. We do not control what a provider may do with your data in breach of their own terms.

---

### 4. Data Retention & Deletion

#### What this means
We keep your data as long as we need it — then we delete it.

| Data type | Retention period |
|---|---|
| Active account data | Until account deletion |
| Booking records | 5 years (tax and legal obligation) |
| Payment references | 5 years |
| Host verification photos | Verification outcome + 1 year |
| Support tickets | 2 years |
| AI conversation logs | 90 days |
| Security / rate-limit logs | 30 days |

#### Your obligation
Submit deletion requests to **cheapstays.me@gmail.com**. We will action them within **30 days**, subject to legal retention obligations.

#### Platform boundary
We will delete or anonymise personal profile data on request. We cannot delete records we are legally required to retain (e.g., financial records). Anonymised aggregate data with no individual identifiers may be retained indefinitely for product analytics.

<!-- COUNSEL: Philippines — confirm NPC-mandated retention periods; assess right-to-erasure obligations under RA 10173 Sec. 16(f) — [DATE] -->

---

### 5. AI Features & Automated Processing

#### What this means
CheapStays uses AI for listing descriptions, search, and the concierge chat. Here is what that means for your data.

#### Your obligation
- Do not submit sensitive personal data (health data, financial account numbers, government ID numbers) through the AI chat interface.
- Understand that your messages are transmitted to Groq's servers for inference.

#### Platform boundary
- The AI does not make autonomous decisions about account suspension, refunds, or bookings — those require human review.
- System prompts are fixed constants in edge-function code; they cannot be overridden by user input.
- User input is capped at 2,000–4,000 characters per message to limit data exposure.
- Messages containing escalation keywords (e.g., *refund, fraud, chargeback, legal, lawsuit*) are flagged for human review and bypass AI handling entirely.

---

### 6. Your Privacy Rights

#### What this means
You have rights over your personal data. Here is how to exercise them.

| Right | How to exercise it |
|---|---|
| Access | Email **cheapstays.me@gmail.com** — response within 30 days |
| Correction | Update directly in account settings, or email us |
| Deletion | Email **cheapstays.me@gmail.com** — actioned within 30 days |
| Portability | Email **cheapstays.me@gmail.com** — data provided in JSON or CSV |
| Objection to processing | Email **cheapstays.me@gmail.com** — we will assess and respond |

<!-- COUNSEL: Philippines — confirm response timelines against NPC requirements; confirm whether a Data Protection Officer must be designated and whether platform must register with NPC — [DATE] -->
<!-- COUNSEL: Philippines — confirm NPC response timelines and whether NPC complaints process must be disclosed to users — [DATE] -->

---

## PART B — Surveillance

### 7. Surveillance Rules for Hosts

#### What this means
Guests have a right to privacy at your property. Certain spaces are absolutely off-limits for recording devices.

#### Your obligation (hosts)
**Banned areas — never place any recording device (camera, microphone, or sensor) in:**
- Bedrooms or sleeping areas
- Bathrooms, toilets, or showers
- Changing areas or dressing rooms
- Any enclosed space where a guest has a reasonable expectation of privacy

**Permitted areas — cameras in common areas (living room, entrance, exterior/driveway) are allowed only if:**
- Disclosed in the listing description **before** the guest books
- Clearly visible (not hidden, embedded, or disguised)
- Not pointed in a direction that captures a private area through an adjacent space or window
- Audio recording capability is disabled while guests occupy the property

#### Platform boundary
CheapStays bans all undisclosed surveillance at listed properties. Guests may report suspected surveillance via the support system; we will investigate and suspend the listing and host account pending findings. Confirmed illegal surveillance will be referred to Philippine authorities (RA 4200, RA 9995). CheapStays is not liable for surveillance violations by individual hosts.

#### Guest rights — if you find or suspect a recording device in a private area
1. Do not tamper with it.
2. Leave the area; document from a safe distance if possible.
3. File a report with CheapStays support immediately.
4. If you believe a crime has occurred, contact local police.

---

### 8. Platform-Side Monitoring

#### What this means
CheapStays monitors platform activity for safety and fraud — not to surveil your private life.

#### Platform boundary
CheapStays logs:
- Login events and IP addresses (account security)
- API request rates (rate limiting and abuse detection)
- Support ticket content (escalation-keyword scanning)
- Booking and payment events (financial records)

We do **not** monitor: private conversations between users outside the CheapStays platform, activity on your device, or your behaviour on other websites.

---

## PART C — Digital Safety

### 9. Protecting Yourself Online

#### What this means
Most scams targeting platform users are social-engineering attacks, not technical breaches. Following these rules protects you.

#### Your obligation
- Conduct all booking communication through the CheapStays platform.
- Never transfer money outside the platform (e.g., direct GCash or Maya transfer to a host) as a substitute for or precursor to a platform booking.
- Report any request to pay outside the platform to **cheapstays.me@gmail.com** immediately.

#### Platform boundary
CheapStays will never ask you for your sign-in link, a one-time code, or any credential via phone, SMS, or social media. Our security vulnerability contact is **security@apexbusinesssystems.ca**. We are not responsible for phishing or social-engineering attacks carried out on channels we do not control.

---

## Checkbox Text

> ☐ **I have read and agree to the Safety, Privacy & Surveillance Bundle.** I understand how CheapStays collects and uses my personal data, I accept the surveillance rules (and will disclose any cameras in my listing if I am a host), and I acknowledge the digital-safety guidance.
