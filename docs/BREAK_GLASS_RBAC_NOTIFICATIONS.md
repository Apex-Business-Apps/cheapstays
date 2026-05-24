# BREAK GLASS: RBAC + Notifications

## Verify admin access
1. In SQL editor, run: `select public.has_role('<user_uuid>', 'admin');`
2. Confirm app session can load roles from `public.user_roles`.

## Restore admin role safely
1. Use audited role mutation RPC if available.
2. If manual recovery is required, insert only missing role row:
   `insert into public.user_roles (user_id, role, granted_by) values ('<user_uuid>', 'admin', '<actor_uuid>');`
3. Do not delete existing roles during recovery.

## Verify has_role grants
```sql
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema='public' and routine_name='has_role';
```
Expect authenticated execute grant.

## Inspect user_roles RLS
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='user_roles';
```

## Inspect notifications policies
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='notifications';
```

## Verify notification read updates
1. Authenticate as regular user.
2. Update own notification `read` to true should pass.
3. Attempt update of `title/body/type/data/user_id` should fail by trigger.
4. Attempt update on another user's notification should fail by RLS.

## Disable auto-approval if needed
- Temporarily disable auto-approval edge function invocation path at scheduler/job layer.
- Keep manual admin workflow enabled.

## Rollback / roll-forward
- Roll forward preferred: apply follow-up migration that corrects bad policy/trigger state.
- Rollback only by introducing a compensating migration; do not drop notification data.

## Warnings
- Never drop `user_roles`.
- Never disable all RLS globally.
- Never broad-grant notification writes to authenticated users.
- Never hide role fetch errors as empty role sets.
