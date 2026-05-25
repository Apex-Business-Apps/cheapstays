# Concept: Two-Path Host Verification

- project: cheapstays
- status: active
- source: CLAUDE.md §5, git PRs #30, #35, #36, #42, #43

## The Concept

A user can become a host via two entirely separate flows. Both produce pending work in the Admin UI but land in different tables and require different approval functions.

```
User wants to be a host
        │
        ├── /host/apply (KYC form)
        │       └── writes to: host_applications
        │           approved via: approve-host-application
        │           admin UI: "Host Applications" tab
        │
        └── Support chat (sends message requesting host access)
                └── writes to: support_tickets (category=host_verification)
                    approved via: approve-host-via-ticket
                    admin UI: "Verification requests" tab
```

## Why It Matters

Conflating both paths was a production bug (PR #42). Any query that only looks at `host_applications` silently misses chat-path applicants. Both must be surfaced.

## Admin UI Contract

```typescript
// KYC path
const { data: applications } = await supabase
  .from("host_applications")
  .select("...")
  .in("status", ["pending", "manual_review"]);

// Chat path — derived from tickets state, not a separate query
const pendingVerificationTickets = useMemo(
  () => tickets.filter(t => t.category === "host_verification" && t.status !== "resolved"),
  [tickets]
);
```

## Approval Function Signatures

```typescript
// KYC path
supabase.functions.invoke("approve-host-application", {
  body: { application_id, target_user_id, reason_code, reviewer_notes? }
});

// Chat path — ticket_id only; user_id extracted server-side
supabase.functions.invoke("approve-host-via-ticket", {
  body: { ticket_id }
});
```

## Related Pages

- [[host-approval-paths]] (decisions)
- [[stack]] (architecture_nodes)
