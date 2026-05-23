# Ingestion Log: Git Log Mining

- date: 2026-05-23
- action: git_log_mining
- source: `git log --format="%H %ad %s" --date=short` — full history
- coverage: 2026-05-21 to 2026-05-23 (~100 commits)
- status: completed

## Extracted Into

- `raw/repo_history/git-log-2026-05-23.md` — immutable chronological record
- `wiki/projects/cheapstays-timeline.md` — compiled phase-by-phase narrative
- `wiki/decisions/stripe-byok-gated.md` — Stripe BYOK + feature flag decision
- `wiki/decisions/omnihub-role-authority.md` — OmniHub authority + admin email
- `wiki/open_loops/pip-ai-concierge.md` — unresolved "Pip" feature
- `wiki/corrections/ticket-status-enum-in_progress-removed.md` — TicketStatus correction

## Key Findings

1. Project history starts at PR #11 — prior repo bootstrapping not in this git history (likely Lovable/Supabase template wiring done outside git).
2. Three distinct phases: Foundation (2026-05-21), Infrastructure (2026-05-22), Feature+Bugfix sprint (2026-05-23).
3. CodeX was used as a secondary AI agent — its auto-fix commits appear throughout, often cleaning up type errors and UX issues.
4. "Changes" batch commits in 2026-05-23 block indicate non-descriptive manual dev work — content unknown without diff inspection.
5. Admin account `jrmendozaceo@apexbusiness-systems.icu` is a known fragile point — was broken and restored once.
6. "Pip" AI concierge mentioned twice but not in CLAUDE.md — open loop, verify before treating as active.

## Missing Coverage

- Commits before 2026-05-21 (repo was bootstrapped from Lovable template `c50d4b1`, dated 2026-04-20, but those early commits are not accessible in the current git history range)
- Content of "Changes" batch commits — would require `git show` per commit
