# CheapStays Legal Copy Style Guide

## Principle

Legal copy is part of the product. If users can't read it, they won't — and uninformed acceptance creates disputes, not protection. Every legal document, disclosure, and in-product notice we publish should be readable by a confident 16-year-old in one pass.

---

## Document Structure

### Lead with the plain-English summary
Every legal document opens with a short summary block — no more than five sentences — that states what the document covers, what the user is agreeing to, and what the consequences of non-compliance are. This is not a substitute for the full document; it's a navigation aid.

**Format:**
```
What this is: [one sentence]
What you're agreeing to: [one to two sentences]
What happens if you don't comply: [one sentence]
Questions: [link or contact point]
```

### Use consistent heading levels
- H1: Document title only
- H2: Major sections
- H3: Subsections
- No H4 or deeper — restructure instead

### Numbered lists for obligations and procedures
If the reader needs to do things in order, number them. If order doesn't matter, use bullets. Never use bullets for a sequence.

### One idea per paragraph
A paragraph that contains two obligations will have one of them ignored. Split them.

---

## Language Rules

### Use plain English for concepts, precise language for definitions

Define a term once, clearly, in plain English. Then use it consistently. Do not paraphrase defined terms — paraphrasing creates ambiguity.

**Defining a term:**
> **Guest Reliability Score** means the numeric indicator described in the [Protection-Naming Guide](/docs/brand/protection-naming.md), calculated as set out in Section 4.

**Using it after definition:**
> If your Guest Reliability Score falls below 60, you will not be able to send new booking requests until it recovers.

### Active voice; name the responsible party

Every obligation needs a subject. Passive voice hides who must act, which creates enforcement gaps and reader confusion.

| Passive (avoid) | Active (use) |
|---|---|
| "The fee may be applied…" | "We will apply the Lost Access Fee if…" |
| "Hosts are required to…" | "You must complete the Fire & Life Safety Attestation before…" |
| "Documents should be retained…" | "CheapStays retains records for 36 months." |

### Conditionals: if/then, not unless/except/notwithstanding

- **unless** — rewrite as a positive **if** statement
- **except** — identify what the exception covers and state it as its own clause
- **notwithstanding** — always replaceable with a plain construction
- **provided that** — use "but only if"
- **inter alia** — use "including"
- **hereinafter** — define the term and use it directly

### Tense

- Present tense for how things work right now.
- Future tense ("will") for consequences and obligations.
- Past tense only in recitals or dispute history sections.

### Numbers and amounts

- Spell out ordinals in running text: "the third violation", not "the 3rd violation".
- Use numerals for all currency, days, percentages, and scores.
- Time periods: numerals + unit spelled out. "14 days", "36 months", not "fourteen (14) days".
- No parenthetical numeral repetition: write "14 days", not "fourteen (14) days".

### Dates

Format: `14 June 2025`. No ordinals. No abbreviations (Jun, Sept). No US month-first format.

---

## Canonical Names in Legal Copy

Use the canonical names from the [Protection-Naming Guide](/docs/brand/protection-naming.md) exactly. Legal documents are one of the surfaces that anchors naming consistency — a legal document that uses "damage report" when the UI says "Property Condition Report" creates a contractual ambiguity.

On first use in a document, link or define the term:
> Your **Property Condition Report** (defined in the [Protection-Naming Guide](/docs/brand/protection-naming.md)) must be filed within 24 hours of guest checkout.

On subsequent uses, the canonical name alone is sufficient.

---

## Specific Document Patterns

### Terms of Service / Terms and Conditions

1. Open with the plain-English summary block.
2. Section 1: Definitions — define every term used in the document, alphabetically.
3. Sections 2–N: Obligations, rights, and procedures. Each section covers one topic.
4. Final section: Governing law, dispute resolution, contact information.
5. Closing: Effective date and version number.

No "whereas" recitals. No "NOW, THEREFORE" preambles.

### Privacy Notices

Follow the structure required by applicable law (GDPR, CCPA, etc.), but write each section in plain English first. Legal precision goes in defined terms and the data table — not in the explanatory prose.

Required sections (in this order):
1. What data we collect
2. Why we collect it (purpose and legal basis)
3. Who we share it with
4. How long we keep it
5. Your rights and how to exercise them
6. How to contact us

### In-Product Notices and Consent Flows

- Maximum three sentences visible before any scroll or expansion.
- The first sentence names the thing being consented to.
- The second sentence states the key consequence of consenting.
- The third sentence (if needed) names the document where full detail lives.
- The call-to-action button label must match the action: "I agree" not "Continue", "Submit" not "OK".

### Email Notifications with Legal Weight

(Payment holds, dispute notices, account actions, policy updates)

Subject line: factual statement of what is happening. No vague subject lines.

- Good: `Your Lost Access Fee — $85 applied to your booking #CS-2847`
- Bad: `Important information about your account`

Body structure:
1. What happened (one sentence, past tense)
2. What it means for the user (one to two sentences)
3. What the user can do (numbered if multiple steps)
4. Deadline, if any (bold)
5. Contact link

---

## What to Cut

Before publishing any legal copy, remove:

- **Hedging phrases** — "generally", "in most cases", "typically", "usually". State the rule or state the exception. Don't blur both.
- **Throat-clearing openings** — "CheapStays is committed to…", "We take your privacy seriously…". Start with the substance.
- **Stacked synonyms** — "null and void", "cease and desist", "terms and conditions". Pick one.
- **Zombie nouns** — "make a determination" → "decide"; "provide notification" → "notify"; "give consideration to" → "consider".
- **Corporate intensifiers** — "strictly prohibited", "expressly forbidden". Prohibited is already strict. Forbidden is already express.
- **Tautologies** — "written notice in writing", "future plans going forward".

---

## Review Checklist

Before any legal copy goes live:

- [ ] Opens with a plain-English summary block.
- [ ] All obligations use active voice with a named subject.
- [ ] All defined terms match the canonical names in the Protection-Naming Guide.
- [ ] No parenthetical numeral repetition (e.g. "fourteen (14)").
- [ ] No hedging phrases that blur obligations.
- [ ] Dates formatted as `DD Month YYYY`.
- [ ] Effective date and version number at the close of the document.
- [ ] Reviewed by Legal for accuracy before Product for tone — not the reverse.

---

## Signoff Owners

| Document Type | Legal Review | Brand/Copy Review |
|---|---|---|
| Terms of Service | Required | Required |
| Privacy Notice | Required | Required |
| In-product consent notices | Required | Required |
| Email notices (legal weight) | Required | Recommended |
| Support scripts referencing policy | Recommended | Required |
| Help centre articles | Not required | Required |
