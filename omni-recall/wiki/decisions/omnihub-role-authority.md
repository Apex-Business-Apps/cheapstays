# Decision: OmniHub Role Authority

- date: 2026-05-22
- source: git log (66b79ae), CLAUDE.md §4.8
- status: active

## Decision

`omnihub-role-authority` edge function handles OmniHub/GitHub registry commands via `execute_role_mutation` RPC. It is a separate authority surface from `admin-role-mutation` — different trigger path, same underlying role mutation machinery.

Admin email for this org: `jrmendozaceo@apexbusiness-systems.icu`

## Background

OmniHub authority was added alongside a contact email correction (66b79ae). The admin account at this email was subsequently broken and had to be restored (d41d570) — likely during a user list migration or auth config change. It is a known fragile point.
