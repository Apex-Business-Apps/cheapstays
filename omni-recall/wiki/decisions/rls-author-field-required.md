# Decision: author_user_id Required on support_messages INSERT

- date: 2026-05-23 (captured from PR #41 fix)
- project: cheapstays
- status: active
- scope: global rule for all support_messages writes

## Decision

Any INSERT into `support_messages` must include `author_user_id: user.id`.

RLS policy requires `author_user_id = auth.uid()` for both user and admin inserts. Missing this field causes a silent RLS rejection that surfaces as "could not send reply" on the frontend — no database error, no helpful message.

## Applies To

All code paths that write to `support_messages`, including admin reply flows.
