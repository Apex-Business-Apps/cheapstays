# CHANGELOG

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.0.0  
**Last Updated:** 2026-05-21

All notable changes to this project are documented in this file.

Format guidance follows Keep a Changelog principles and semantic release headings.

## [1.0.0] - 2026-05-21

### Added
- RBAC admin dashboard capabilities for role grant/revoke operations and visibility into role audit logs and support tickets.
- Concierge request persistence model (`concierge_requests`) with RLS and operational indexes.
- Operational documentation set:
  - `docs/ONBOARDING.md`
  - `docs/RUNBOOK.md`
  - `docs/STATUS.md`
  - `docs/VERSIONING.md`

### Changed
- Hero carousel expanded to include eight additional city destination slides while preserving existing motion behavior.
- RLS policies hardened for support ticket updates and support message inserts.
- Top-level README replaced with versioned operational/project documentation.

### Security
- Enforced stricter RLS write-time checks for support and concierge workflows.
- Standardized least-privilege token guidance for Cloudflare deployment operations.
