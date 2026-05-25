# CheapStays Coding Directives

- project: cheapstays
- source: CLAUDE.md §11 regression trip-wires, PRs #41–43
- status: active, permanent

These are non-negotiable rules derived from production bugs. They apply to all code touching this repo.

## D1 — Always include author_user_id in support_messages INSERT

```typescript
// correct
{ ticket_id, sender: "admin", content, author_user_id: user.id }
```

RLS silently rejects the insert otherwise. No error, no retry, just failure.

## D2 — Always await rateLimit()

```typescript
// correct
const rl = await rateLimit(`key`, 20, 60_000);
if (!rl.ok) return rateLimitResponse();
```

Unawaited, `rl` is a Promise. `!rl.ok` is always false. Rate limiting never fires.

## D3 — Never call grant-host-role for host approvals

Use `approve-host-via-ticket` (ticket path) or `approve-host-application` (KYC path). `grant-host-role` is deprecated and blocks self-grant.

## D4 — Use userId (string) not user (object) as hook dependency

```typescript
const userId = user?.id;
const loadData = useCallback(async () => { ... }, [userId]); // not [user]
```

The `user` object reference changes on every auth state check. Using it as a dependency causes infinite re-render loops.

## D5 — Unwrap FunctionsHttpError before displaying

```typescript
let msg = error.message;
try {
  const body = await (error as { context?: Response }).context?.json();
  if (body?.error) msg = body.error;
} catch {}
toast.error(msg);
```

Raw `.message` always shows "Edge Function returned a non-2xx status code."

## D6 — Admin Applications tab must query both host application paths

`host_applications` (KYC) AND `support_tickets` where `category = "host_verification"`. Querying only one path silently misses applicants.

## D7 — TicketStatus valid values

`open` | `escalated` | `resolved` — `in_progress` was removed from the DB enum.
