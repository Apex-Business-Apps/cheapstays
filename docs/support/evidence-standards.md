# Evidence Standards

**Organization:** APEX Business Systems Ltd.
**Location:** Edmonton, AB
**Document Version:** 1.0.0
**Classification:** Internal — Support Operations / Legal
**Last Updated:** 2026-05-22
**Next Review:** 2026-08-22

---

## 1. Purpose

This document defines what records CheapStays preserves, under what conditions records are released, how platform evidence is structured, and the process for external parties to submit a lawful data request.

CheapStays is a booking platform, not a law enforcement body. CheapStays does not investigate crimes, conduct forensic analysis, or issue legal determinations. The platform preserves records and cooperates with properly authorized legal requests.

---

## 2. Records CheapStays Holds

The following records are maintained in the Supabase database and are subject to Row Level Security (RLS). Admin-level access is required to retrieve most records.

| Record Type | Table | Contents | Retention |
|-------------|-------|----------|-----------|
| User account | `profiles` | Display name, avatar URL, account creation date | Duration of account; 90 days post-deletion |
| Role history | `role_audit_log` | Role granted/revoked, actor, timestamp | Indefinite |
| Booking record | `bookings` | Guest ID, host ID, listing ID, dates, guest count, total amount (PHP), payment status, payment method, PayMongo intent ID, cancellation reason, timestamps | 7 years (financial records) |
| Listing record | `listings` | Host ID, title, description, city, price, status, timestamps | Duration of listing; 90 days post-deletion |
| Review record | `reviews` | Reviewer ID, listing ID, booking ID, rating, content, public flag, timestamps | 7 years |
| Support ticket | `support_tickets` | Submitter ID, subject, status, priority, escalation flag, timestamps | 5 years |
| Support messages | `support_messages` | Ticket ID, sender, content, timestamps | 5 years |
| Notification log | `notifications` | User ID, type, message, read state, timestamps | 1 year |

**CheapStays does not hold:**
- Full card numbers, CVV, or raw payment credentials (these are never transmitted to or stored by the platform)
- Real-time location data or GPS coordinates of guests or hosts
- Contents of communications that occurred outside the platform (phone calls, in-person conversations, off-platform messaging apps)
- Physical evidence of any kind

---

## 3. What Triggers Preservation

A record preservation hold is placed on all data related to a case when any of the following events occur:

- A support ticket is flagged as `escalated = true` by the system or an agent
- A user reports a crime, assault, illegal surveillance, fraud, or cyber abuse
- A user or their representative indicates intent to pursue legal action
- A law enforcement officer contacts CheapStays by any channel
- An admin agent manually places a hold during Tier 2/3 review

**Preservation means:** the records and any associated user accounts, bookings, listings, and messages are not deleted, modified, or purged until the hold is released by Tier 3 review. Holds override standard retention expiry.

**Preservation does not mean disclosure.** Records on hold are retained internally. They are not shared with any party until a valid legal order is received.

---

## 4. Standard Evidence Package

When a valid legal order is received, the following evidence package is compiled by an admin:

### 4.1 Booking Evidence Export

For a specific booking:

- Booking record fields: `id`, `listing_id`, `guest_id`, `host_id`, `check_in`, `check_out`, `nights`, `guests`, `total_php`, `status`, `payment_status`, `payment_method`, `paymongo_payment_intent_id`, `created_at`, `confirmed_at`, `cancelled_at`, `cancellation_reason`
- Associated listing record: `id`, `title`, `city`, `nightly_php`, `status`, `host_id`
- Associated review (if any): `rating`, `content`, `created_at`, `is_public`

### 4.2 Account Evidence Export

For a specific user account:

- Profile: `id`, `full_name`, `avatar_url`, `created_at`
- Role history from `role_audit_log`: all entries for the user
- Booking history (guest and host): all bookings linked to the user ID
- Support ticket history: all tickets submitted by the user

**Note:** Email addresses are managed by Supabase Auth and are not stored in the `profiles` table. Email data requires a separate request to Supabase, Inc., which operates the authentication infrastructure. CheapStays will advise requesting parties of this limitation.

### 4.3 Support Communication Export

For a specific support ticket:

- Ticket record: all fields
- All messages in `support_messages` for the ticket: `sender`, `content`, `created_at`

### 4.4 Format

All exports are provided as:
- CSV (tabular records) or JSON (structured records), at the requesting authority's preference
- Exports are accompanied by a signed cover letter identifying the date of export, the admin who generated it, and the legal order under which it was produced

---

## 5. How to Submit a Lawful Data Request

CheapStays releases user data only in response to a valid legal instrument issued by a competent court or law enforcement authority with jurisdiction over the matter.

**Submission address:**
```
legal@apexbusinesssystems.ca
```

**Required elements of a valid request:**

1. **Legal instrument:** Subpoena, court order, production order, or equivalent instrument valid in the jurisdiction of the data or the organization
2. **Jurisdiction:** State the court or authority issuing the order and its jurisdiction
3. **Scope:** Specify the user(s), booking(s), listing(s), or time range at issue — requests must be specific and proportionate; bulk requests without specification will not be fulfilled without further legal process
4. **Return address:** Official contact for the requesting authority (badge number, agency, address, case number)
5. **Deadline:** Any statutory deadline for production

**What CheapStays will not do without a valid legal order:**
- Confirm or deny whether a specific person has an account
- Provide records about a user to another user or a third party
- Provide records to a party claiming to represent a user without verified authorization
- Provide records to an attorney, private investigator, or civil party without a court order

**Timeline:** CheapStays will acknowledge receipt of a valid legal order within 2 business days and will confirm a production timeline within 5 business days.

---

## 6. Emergency Disclosure (Imminent Risk to Life)

CheapStays may disclose limited records to law enforcement without a court order only if:

- The request is from a verified law enforcement officer (badge, agency, case number)
- The officer represents that there is an imminent risk to the life or safety of a specific person
- The disclosure is limited to what is necessary to respond to the immediate risk

Any emergency disclosure is logged and escalated to Tier 3 immediately. Legal counsel is notified.

CheapStays does not make emergency disclosures to private parties, attorneys, or individuals claiming to be acting on behalf of law enforcement without direct law enforcement contact.

---

## 7. Evidence Integrity

All production exports are generated directly from the live Supabase database by an admin with the service role. Exports are not modified after generation.

- The generating admin records the export timestamp and the query or filter used
- The cover letter is signed by an authorized APEX Business Systems representative
- Exports are transmitted to authorities via encrypted email or secure file transfer; records are not sent via plain email or consumer file-sharing services

CheapStays does not alter, fabricate, or selectively omit records in response to a legal order. If a record no longer exists at the time of a lawful request (e.g., because the retention period elapsed before a hold was placed), the absence of the record is noted in the production letter.

---

## 8. What CheapStays Cannot Provide

The following are outside platform capability and will be stated as such in any response to a legal request:

| Item | Reason |
|------|--------|
| Card numbers, CVV, bank account numbers | Never collected or stored by the platform |
| Off-platform communications | Not accessible to CheapStays |
| Real-time or historical location data | Not collected |
| Content of calls or in-person conversations | Not collected |
| PayMongo transaction records | Held by PayMongo, Inc.; request must be directed to them |
| Supabase Auth email/phone records | Held by Supabase, Inc.; request must be directed to them |
| Historical IP login records beyond Supabase Auth retention | Not retained by CheapStays; may be available from Supabase |

Where records are held by a third-party infrastructure provider (PayMongo, Supabase, Cloudflare), CheapStays will identify the provider and provide what contact information is available to assist the requesting authority in making a separate lawful request.

---

## 9. User Rights and Requests (Non-Legal)

A user requesting a copy of their own data may submit a data access request by opening a support ticket with the subject "Data Access Request." CheapStays will provide the user's own records (profile, bookings, reviews, support tickets) within 30 days, subject to identity verification.

CheapStays does not provide one user's data to another user regardless of the stated relationship. Requests that would require disclosure of another user's personal information require a court order.

---

## 10. Contact

| Purpose | Contact |
|---------|---------|
| Legal orders and law enforcement | legal@apexbusinesssystems.ca |
| Security vulnerability reports | security@apexbusinesssystems.ca |
| General support | Platform support ticket system |

---

*See also: [`support-sop.md`](./support-sop.md) | [`incident-matrix.md`](./incident-matrix.md)*
