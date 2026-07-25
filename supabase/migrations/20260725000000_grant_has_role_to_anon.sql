-- ============================================================
-- Grant EXECUTE on public.has_role to the anon role.
--
-- Anonymous readers of RLS-protected tables (e.g. stay_voucher_batches
-- with a "TO public" admin policy that calls has_role) fail with
-- "permission denied for function has_role" without this grant. The
-- function is SECURITY DEFINER and just returns false when called for
-- an anon session (no user_roles row for anon), so granting EXECUTE is
-- safe: no data is exposed.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon;
