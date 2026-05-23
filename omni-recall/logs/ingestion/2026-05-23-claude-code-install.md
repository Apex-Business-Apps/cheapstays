# Installation Log: Claude Code Adaptation

- date: 2026-05-23
- action: omni-recall_claude-code-install
- runtime: Claude Code (claude-sonnet-4-6), remote container
- repo: apex-business-apps/cheapstays
- branch: claude/intelligent-dijkstra-Gemqc
- status: completed

## Runtime Adaptation Notes

The Omni-Recall blueprint was designed for a GPT-agent workspace with `/workspace/memory/` as its root.
In this Claude Code runtime, durable memory persists via **git commits to this repo**.

Path mapping:
- Blueprint root `/workspace/memory/omni-recall/` → repo path `omni-recall/`
- Memory persists across sessions only if changes are committed and pushed.
- No always-on hooks or automatic background processes available.
- All external connectors (Gmail, Drive, Slack) are Phase 2 — not yet wired.

## Completed in This Install

- Extracted `omni-recall-package-2026-05-23.zip` into repo root
- Created all missing canonical folders from blueprint §5:
  - `raw/chat_exports`, `raw/repo_history`, `raw/docs_and_briefs`
  - `wiki/architecture_nodes`, `wiki/concepts`, `wiki/projects`, `wiki/decisions`
  - `wiki/open_loops`, `wiki/rejected_patterns`
  - `logs/health_checks`
- Seeded from repo-resident `CLAUDE.md` (baseline PRs #41–43):
  - `wiki/projects/cheapstays.md`
  - `wiki/architecture_nodes/stack.md`
  - `wiki/decisions/host-approval-paths.md`
  - `wiki/decisions/rls-author-field-required.md`
  - `wiki/corrections/react-hook-dependency-object-vs-string.md`
- Updated `state/checkpoints/current-status.md`
- Updated `wiki/source_indexes/omni-recall-source-index.md`

## Historical Backfill Status

- pending: prior Claude/ChatGPT session exports not yet provided
- available now: repo CLAUDE.md baseline (fully ingested above)
- available now: git log (not yet mined; run on demand)
