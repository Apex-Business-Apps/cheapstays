# Open Loop: "Pip" AI Concierge

- opened: 2026-05-23 (mined from git log)
- source: commits f53d3b4 (#12) and b59a233 (#15)
- status: unresolved

## What Is Known

"Pip" is referenced in two commit messages as an AI concierge context feature wired to listings and bookings. It appears alongside the core listing flow (#12) and the advanced search/ratings layer (#15).

It is not documented in CLAUDE.md and not visible in the edge function registry (`ai-chat`, `ai-search`, `ai-describe` are documented; no `pip` function listed).

## Open Questions

- Is Pip a frontend-only component or does it call a backend function?
- Is it the same as or distinct from `ai-chat`?
- Is it still active or was it renamed/removed?

## Action

Read `src/` for Pip references before assuming it's live. Do not document it as active until verified.
