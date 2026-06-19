# Documentation & Release Versioning Standard

**Organization:** JGP Corporation  
**Location:** Pasig City, Metro Manila, Philippines  
**Document Version:** 1.0.0  
**Last Updated:** 2026-05-21

## 1) Purpose

Define a consistent versioning policy for:
- platform releases
- schema/policy migrations
- operational documentation

## 2) Semantic Versioning (Platform)

Use `MAJOR.MINOR.PATCH`:

- **MAJOR**: incompatible API/data/behavior change.
- **MINOR**: backward-compatible feature addition.
- **PATCH**: backward-compatible fix, refactor, or operational correction.

## 3) Document Versioning

Every governance/operations document MUST include:
- `Document Version`
- `Last Updated` (YYYY-MM-DD)

Increment rules:
- **Major doc bump** (`2.0.0`) for structural or policy-overhaul changes.
- **Minor doc bump** (`1.1.0`) for meaningful content additions (new sections/procedures).
- **Patch doc bump** (`1.0.1`) for clarifications/typos/non-semantic edits.

## 4) Migration Versioning

Migration filenames MUST remain timestamp-prefixed:
- `YYYYMMDDHHMMSS_description.sql`

Additional requirements:
- one migration per coherent schema/policy unit
- idempotent or safe-retry where feasible
- reflected in `docs/STATUS.md` and `docs/CHANGELOG.md`

## 5) PR Release Note Template

Use this minimum release-note structure in PRs:

1. **Version Target**: `vX.Y.Z`
2. **Change Type**: feature/fix/security/docs/ops
3. **Scope**: affected modules/tables/routes
4. **Risk Level**: low/medium/high
5. **Verification**: exact commands and outcomes
6. **Rollback Plan**: how to revert safely

## 6) Date & Time Policy

- Use ISO-8601 date format: `YYYY-MM-DD`.
- When recording incident timestamps, use UTC and explicit offset.

## 7) Ownership

- Engineering owns code/schema versioning.
- Operations owns runbook/status document freshness.
- PR author is accountable for version/date updates in touched docs.
