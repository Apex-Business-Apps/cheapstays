# Project: CheapStays

- status: active
- type: Philippine short-term rental marketplace
- org: APEX Business Systems Ltd.
- canonical_baseline: 2026-05-25 @ main `e2af13e`
- source: `CLAUDE.md` (repo root)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion |
| Routing | react-router-dom v6 |
| State | @tanstack/react-query v5 + Supabase realtime |
| Backend | Supabase Edge Functions (Deno) |
| Auth | Supabase Auth (JWT) |
| Database | PostgreSQL 17 via Supabase, RLS enforced |
| Payments | PayMongo (primary), Stripe (secondary, gated) |
| AI | Groq llama-3.3-70b-versatile |
| CI/CD | GitHub Actions → Cloudflare Pages |

## Roles

`admin` > `host` > `member` > `user` — stored in `user_roles`, checked via `has_role()` RPC.

## Critical Constraints (from PR #41–43 fixes)

1. `support_messages` INSERT requires `author_user_id = auth.uid()` — omitting it causes silent RLS failure.
2. `rateLimit()` must be `await`ed — unawaited call silently bypasses rate limiting.
3. `approve-host-via-ticket` / `approve-host-application` are the only valid host approval paths. `grant-host-role` is deprecated.
4. React hooks must use `userId` (string) not `user` (object) as dependency — object reference changes on every auth state check cause infinite re-render.
5. Admin Applications tab must query both `host_applications` (KYC path) and `support_tickets` (chat path, `category = "host_verification"`).

## Additional Constraints (post-merge updates through 2026-05-25)

6. Canonical booking path (`book-listing`) must enforce and distinguish: `booking_overlap`, `blackout_conflict`, and `declared_availability_exceeded`; backend remains source of truth.
7. Short-term flow can use provisional `payment_pending` state only with transition-map and DB/index alignment (`bookings_active_idx` includes `payment_pending`).
8. Runtime RLS guardrail invariant is deny-by-anon for admin users endpoint (valid deny may be HTTP 401 or HTTP 403 with `not_admin`/`User not allowed`).
9. Production deploy workflow requires Node 22+ for Wrangler and uses `CLOUDFLARE_AGENT_TOKEN` wiring.
10. Release evidence provenance records must include explicit evidence-source metadata in `final_report.txt`.

## Open Loops

- Historical backfill of prior Claude/ChatGPT session exports: pending (user to provide)
- [[pip-ai-concierge]] — closed: Pip is the brand name for `AiChatBubble` → `ai-chat` edge function

## Related Pages

- [[stack]] (architecture_nodes)
- [[omni-recall-core-directives]]
