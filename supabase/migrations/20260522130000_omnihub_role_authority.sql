-- =========================================
-- OMNIHUB ROLE AUTHORITY
-- All privileged role mutations must flow through OmniHub /
-- GitHub-registry command authority with a full immutable audit trail.
-- No app UI, AI agent, edge function, or ordinary admin flow may
-- silently grant or revoke privileged roles.
-- =========================================

-- 1. Keep live trigger scoped to approved CheapStays CEO address only
CREATE OR REPLACE FUNCTION public.auto_grant_admin_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IN (
    'james.plofino.ceo@cheapstays.me'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 2. Extend github_command_registry with authority metadata
ALTER TABLE public.github_command_registry
  ADD COLUMN IF NOT EXISTS command_type  text,
  ADD COLUMN IF NOT EXISTS expires_at    timestamptz;

-- 3. Immutable role mutation audit table
CREATE TABLE public.role_mutation_audit (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- OmniHub command provenance
  command_id      text        NOT NULL,
  command_source  text        NOT NULL,
  requester_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approver_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- What changed
  operation       text        NOT NULL CHECK (operation IN (
    'grant_host', 'revoke_host',
    'grant_admin', 'revoke_admin',
    'suspend_user', 'reinstate_user',
    'emergency_lockout'
  )),
  target_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code     text        NOT NULL,

  -- State snapshots (before / after)
  before_state    jsonb       NOT NULL DEFAULT '{}',
  after_state     jsonb       NOT NULL DEFAULT '{}',

  -- Executor
  executed_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address      text
);

ALTER TABLE public.role_mutation_audit ENABLE ROW LEVEL SECURITY;

-- Immutable: nobody may update or delete records
CREATE POLICY "role_mutation_audit no updates"
  ON public.role_mutation_audit FOR UPDATE TO authenticated USING (false);

CREATE POLICY "role_mutation_audit no deletes"
  ON public.role_mutation_audit FOR DELETE TO authenticated USING (false);

CREATE POLICY "Admins read role mutation audit"
  ON public.role_mutation_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only service_role (edge functions) inserts; service_role bypasses RLS,
-- this policy guards direct API calls by authenticated users.
CREATE POLICY "No authenticated insert into role_mutation_audit"
  ON public.role_mutation_audit FOR INSERT TO authenticated WITH CHECK (false);

CREATE INDEX idx_role_mutation_audit_target  ON public.role_mutation_audit(target_user_id);
CREATE INDEX idx_role_mutation_audit_command ON public.role_mutation_audit(command_id);
CREATE INDEX idx_role_mutation_audit_created ON public.role_mutation_audit(created_at DESC);

-- 4. User suspensions table
CREATE TABLE public.user_suspensions (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  suspended_at   timestamptz NOT NULL DEFAULT now(),
  reinstated_at  timestamptz,
  reason_code    text        NOT NULL,
  suspended_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  command_id     text        NOT NULL
);

ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages suspensions"
  ON public.user_suspensions FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins read suspensions"
  ON public.user_suspensions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_suspensions_active
  ON public.user_suspensions(user_id) WHERE reinstated_at IS NULL;

-- 5. is_suspended helper
CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_suspensions
    WHERE user_id = _user_id AND reinstated_at IS NULL
  );
$$;

-- 6. Core role mutation function
-- Called only by the omnihub-role-authority edge function via service_role.
-- Validates the command is in the registry, prevents replay, snapshots state,
-- executes the operation, and writes an immutable audit record atomically.
CREATE OR REPLACE FUNCTION public.execute_role_mutation(
  p_command_id     text,
  p_command_source text,
  p_requester_id   uuid,
  p_approver_id    uuid,
  p_operation      text,
  p_target_user_id uuid,
  p_reason_code    text,
  p_executed_by    uuid,
  p_ip_address     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before   jsonb;
  v_after    jsonb;
  v_audit_id uuid;
  v_cmd      record;
BEGIN
  -- Validate the command exists in registry and is approved
  SELECT id, approved, source, expires_at, command_type
  INTO v_cmd
  FROM public.github_command_registry
  WHERE id = p_command_id;

  IF v_cmd IS NULL THEN
    RAISE EXCEPTION 'Command % not found in registry', p_command_id;
  END IF;

  IF NOT v_cmd.approved THEN
    RAISE EXCEPTION 'Command % is not approved', p_command_id;
  END IF;

  IF v_cmd.source <> p_command_source THEN
    RAISE EXCEPTION 'Command source mismatch: expected %, got %', v_cmd.source, p_command_source;
  END IF;

  IF v_cmd.expires_at IS NOT NULL AND v_cmd.expires_at < now() THEN
    RAISE EXCEPTION 'Command % has expired at %', p_command_id, v_cmd.expires_at;
  END IF;

  -- Replay prevention: each command may only be executed once
  IF EXISTS (SELECT 1 FROM public.role_mutation_audit WHERE command_id = p_command_id) THEN
    RAISE EXCEPTION 'Command % has already been executed (replay prevention)', p_command_id;
  END IF;

  -- Snapshot before state
  SELECT jsonb_build_object(
    'roles', COALESCE(
      (SELECT jsonb_agg(role ORDER BY role) FROM public.user_roles WHERE user_id = p_target_user_id),
      '[]'::jsonb
    ),
    'suspended', public.is_suspended(p_target_user_id)
  ) INTO v_before;

  -- Execute the operation
  CASE p_operation
    WHEN 'grant_host' THEN
      INSERT INTO public.user_roles (user_id, role, granted_by)
      VALUES (p_target_user_id, 'host', p_executed_by)
      ON CONFLICT (user_id, role) DO NOTHING;

    WHEN 'revoke_host' THEN
      DELETE FROM public.user_roles
      WHERE user_id = p_target_user_id AND role = 'host';

    WHEN 'grant_admin' THEN
      INSERT INTO public.user_roles (user_id, role, granted_by)
      VALUES (p_target_user_id, 'admin', p_executed_by)
      ON CONFLICT (user_id, role) DO NOTHING;

    WHEN 'revoke_admin' THEN
      DELETE FROM public.user_roles
      WHERE user_id = p_target_user_id AND role = 'admin';

    WHEN 'suspend_user' THEN
      INSERT INTO public.user_suspensions (user_id, reason_code, suspended_by, command_id)
      VALUES (p_target_user_id, p_reason_code, p_executed_by, p_command_id)
      ON CONFLICT (user_id) DO UPDATE SET
        suspended_at  = now(),
        reinstated_at = NULL,
        reason_code   = EXCLUDED.reason_code,
        suspended_by  = EXCLUDED.suspended_by,
        command_id    = EXCLUDED.command_id;

    WHEN 'reinstate_user' THEN
      UPDATE public.user_suspensions
      SET reinstated_at = now()
      WHERE user_id = p_target_user_id AND reinstated_at IS NULL;

    WHEN 'emergency_lockout' THEN
      -- Revoke all elevated roles then hard-suspend
      DELETE FROM public.user_roles
      WHERE user_id = p_target_user_id AND role IN ('host', 'admin');
      INSERT INTO public.user_suspensions (user_id, reason_code, suspended_by, command_id)
      VALUES (p_target_user_id, p_reason_code, p_executed_by, p_command_id)
      ON CONFLICT (user_id) DO UPDATE SET
        suspended_at  = now(),
        reinstated_at = NULL,
        reason_code   = EXCLUDED.reason_code,
        suspended_by  = EXCLUDED.suspended_by,
        command_id    = EXCLUDED.command_id;

    ELSE
      RAISE EXCEPTION 'Unknown operation: %', p_operation;
  END CASE;

  -- Snapshot after state
  SELECT jsonb_build_object(
    'roles', COALESCE(
      (SELECT jsonb_agg(role ORDER BY role) FROM public.user_roles WHERE user_id = p_target_user_id),
      '[]'::jsonb
    ),
    'suspended', public.is_suspended(p_target_user_id)
  ) INTO v_after;

  -- Write immutable audit record
  INSERT INTO public.role_mutation_audit (
    command_id, command_source, requester_id, approver_id,
    operation, target_user_id, reason_code,
    before_state, after_state, executed_by, ip_address
  ) VALUES (
    p_command_id, p_command_source, p_requester_id, p_approver_id,
    p_operation, p_target_user_id, p_reason_code,
    v_before, v_after, p_executed_by, p_ip_address
  ) RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'audit_id',       v_audit_id,
    'operation',      p_operation,
    'target_user_id', p_target_user_id,
    'before',         v_before,
    'after',          v_after,
    'command_id',     p_command_id,
    'timestamp',      now()
  );
END;
$$;

-- 7. Lock down direct API mutations on user_roles.
-- Admins must use the omnihub-role-authority edge function.
-- service_role (used by edge functions) bypasses RLS entirely.
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
