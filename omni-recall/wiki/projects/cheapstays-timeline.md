# CheapStays — Project Timeline

- source: git log, mined 2026-05-23
- coverage: 2026-05-21 to 2026-05-25 (extended with post-baseline CI/guardrail/payment-flow hardening merges)

## Phase 1 — Foundation (2026-05-21)

Core marketplace built in a single burst across PRs #11–17:
- Agoda affiliate search integration (PH properties)
- Production listing flow (search, detail, host form)
- Image + video upload for listings
- Booking flow, availability calendar, guest reviews
- Two-way ratings, host bookings dashboard, advanced search
- "Pip" AI concierge context wired to listings

Ended with "codebase completeness audit — bring build to 100/100" (0a47c03), suggesting a deliberate quality gate before moving to infrastructure.

## Phase 2 — Infrastructure + Governance (2026-05-22)

Heavy vertical expansion:
- PayMongo + Stripe payment architecture (#23) — Stripe scaffold included from start
- AI guardrails + audit logs (#25)
- LegalScrollGate + immutable legal consent audit (#19)
- Legal document suite, support SOP, incident matrix
- Host KYC onboarding (#30)
- Admin dashboard overhaul (stats, tabs, tickets)
- Notifications center + end-to-end wiring
- OmniHub role authority + `execute_role_mutation` RPC
- **Admin account break and restore:** `jrmendozaceo@apexbusiness-systems.icu` accidentally removed during refactor, then restored (d41d570)

## Phase 3 — Feature Completion + Bug Fix Sprint (2026-05-23)

- BYOK Stripe backend added (233a143) — user brings their own Stripe keys
- Stripe migration + edge function wired (c739d96)
- Host application review workflow, KYC approval UI (#35, #36)
- Membership tier system with PayMongo (#37)
- Large omnibus PR #38: legal docs, host onboarding, notifications, AI guardrails, payment & role authority
- PostgreSQL migration syntax fix (8bf811e)
- Tech debt cleanup PR #40: payment flow, Agoda search, push types, support realtime
- **Production bug fix cluster (PRs #41–43):**
  - Missing `author_user_id` in support_messages INSERT
  - Missing `await` on `rateLimit()`
  - `useNotifications` object dependency causing crash
  - Admin Applications tab missing chat-path applications
  - `grant-host-role` deprecated; `approve-host-via-ticket` created
- CLAUDE.md baseline committed

## Recurring Patterns in History

- TypeScript errors fixed in separate commits repeatedly — suggests scaffolded or AI-generated code shipped with type gaps
- CodeX auto-fixes appear frequently (auth CTAs, navbar, host dashboard, notifications) — CodeX was used as a secondary agent
- "Changes" batch commits (dirty workflow) visible in 2026-05-23 block — manual work without descriptive commits
- Supabase connection re-initiated mid-sprint (24849d4) — suggests a project migration or re-link event

## Open Questions From History

- What is "Pip"? Referenced in PR #12 and #15 as an AI concierge context feature. Not documented in CLAUDE.md.
- What triggered the admin account breakage (d41d570)? Likely a user list reset or migration.
- What was in the early "Changes" batch commits on 2026-05-23 before BYOK Stripe?

## Phase 4 — Booking/Guardrail Hardening + Release Automation Updates (2026-05-25)

- PR #63 merged into `main` (branch: `codex/implement-booking-enforcement-and-consent-checks`):
  - backend booking-path enforcement expanded for declared availability windows + blackout conflicts with distinct conflict branches,
  - provisional short-term `payment_pending` flow introduced with DB + transition updates,
  - new guardrail scripts added (runtime RLS, privileged-path drift, release-evidence provenance),
  - CI workflow updated to run runtime RLS verification using repository secrets,
  - production workflow updated for Wrangler/Node 22 compatibility and Cloudflare agent token wiring.
- Follow-up fix on `main` adjusted runtime RLS guardrail expectation to treat Supabase’s admin-deny variants as valid secure outcomes (HTTP 401 or HTTP 403 `not_admin`/`User not allowed`), preventing false CI regression signals while keeping denial strict.
