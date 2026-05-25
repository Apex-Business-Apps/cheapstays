# Current Status

- date: 2026-05-25
- omni_recall_status: active — Phase E (ambient)
- runtime: Claude Code (git-backed, repo omni-recall/)
- branch: work
- verification_provenance_recorded: true (`final_report.txt` includes branch + UTC timestamp + evidence source)

## Backfill

- repo_git_log_mined: true (2026-05-21–2026-05-23)
- repo_baseline_ingested: true (CLAUDE.md @ main a393243)
- external_session_exports: skipped by user

## Wiki

- projects: cheapstays.md, cheapstays-timeline.md
- architecture_nodes: stack.md, edge-functions-registry.md
- concepts: two-path-host-verification.md, rls-silent-failure-pattern.md
- decisions: host-approval-paths, rls-author-field-required, stripe-byok-gated, omnihub-role-authority
- corrections: react-hook-dependency, ticket-status-enum
- open_loops: pip-ai-concierge (CLOSED — brand name for AiChatBubble/ai-chat)
- directives: omni-recall-core-directives, cheapstays-coding-directives (D1–D7)

## Health

- last_health_check: 2026-05-25 (post-merge reality sync for PR #63 + CI/runtime guardrail behavior)
- contradictions: 0
- orphaned_decisions: 0
- unresolved_open_loops: 0
- corrections_promoted_to_directives: 3/3
- installation_complete: true

## Current Reality Snapshot (2026-05-25)

- merged_change_anchor: PR #63 (`main` contains booking availability/blackout enforcement + payment_pending flow + new guardrails/workflow edits).
- in_flight: PR #65 (`fix/legal-consent-gate-acceptance-flow`) — legal consent dead-end fix, open, awaiting merge.
- ci_guardrail_note: runtime RLS guardrail originally overfit anon admin denial to HTTP 401; Supabase can return HTTP 403 `not_admin` / `User not allowed` for the same secure deny condition.
- deployment_note: production deploy workflow now expects Node 22 and `CLOUDFLARE_AGENT_TOKEN` mapped into Wrangler-compatible env.
- node_modules_state: `date-fns` locale lib has a corrupt install (`buildFormatLongFn.mjs` missing); 3 test suites fail at baseline — pre-existing, unrelated to consent fix. `npm ci` also fails due to `lodash/fp` ENOTEMPTY — use `npm install` as workaround until clean environment.
