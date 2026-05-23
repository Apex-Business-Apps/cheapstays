# Correction: TicketStatus enum — in_progress removed

- date: 2026-05-22/23
- source: git commits a588794, a0656f8
- scope: project-wide (support_tickets status column)

## Corrected State

`TicketStatus` DB enum values are: `open`, `escalated`, `resolved`

`in_progress` was removed to align TypeScript with the actual Postgres enum. `escalated` was added.

Any code referencing `in_progress` as a valid ticket status is wrong.
