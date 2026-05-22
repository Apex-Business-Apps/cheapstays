-- rate_limits is internal infrastructure used only by edge functions via service_role.
-- Enable RLS with no permissive policies so PostgREST exposes nothing to anon/authenticated.
-- service_role bypasses RLS by default, so edge functions are unaffected.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
