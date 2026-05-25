# Concept: RLS Silent Failure Pattern

- project: cheapstays
- status: active
- source: CLAUDE.md §5, §11, PRs #41–43

## The Pattern

Supabase RLS policies that require a column to match `auth.uid()` silently reject inserts/selects when the column is missing or wrong. No database error is thrown. The frontend receives an empty result or a vague edge function error.

This is the hardest class of bug in this codebase because:
- No stack trace
- No DB error message
- Symptoms look like a network or logic error

## Known Instances

### `support_messages` INSERT

Policy requires `author_user_id = auth.uid()`.
Missing `author_user_id` → silent rejection → "could not send reply" error on frontend.

```typescript
// Wrong
{ ticket_id, sender: "admin", content }

// Correct
{ ticket_id, sender: "admin", content, author_user_id: user.id }
```

### `notifications` SELECT

Policy filters `user_id = auth.uid()`. Always add `.eq("user_id", userId)` explicitly — RLS handles it but without the filter the query returns nothing for admin users.

## Detection Rule

Whenever an INSERT or SELECT returns unexpectedly empty/rejected with no clear error:
1. Check if a column with `= auth.uid()` constraint is missing from the query
2. Check if the user's session is valid at call time
3. Do NOT assume a network error until RLS is ruled out

## Related Pages

- [[rls-author-field-required]] (decisions/corrections)
