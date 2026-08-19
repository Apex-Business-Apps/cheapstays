-- Fix admin RLS on wallet tables.
--
-- Context:
--   The 2025-05-27 wallet migration guarded admin bypass with
--     auth.jwt() ->> 'role' = 'admin'
--   That predicate is never true for real admins: Supabase JWTs carry
--     "role":"authenticated"
--   and the app-level "admin" role lives in public.user_roles, not in JWT
--   claims. Consequence: admins reading /admin/payments could not see any
--   host_wallets, wallet_transactions, disbursement_requests, or
--   host_payout_accounts rows. The Wallet health card computed its
--   credited/released status from an empty ledger and mislabelled every
--   already-released booking as "Never credited".
--
--   CLAUDE.md's post-2026-07-22 regression trip-wire explicitly calls this
--   out: new admin RLS must use public.has_role(auth.uid(), 'admin').
--
-- Fix:
--   Drop and recreate each admin bypass policy using has_role.
--   The host-owned SELECT policies are untouched.

DROP POLICY IF EXISTS "host_wallet_admin_all"        ON public.host_wallets;
DROP POLICY IF EXISTS "wallet_tx_admin_all"          ON public.wallet_transactions;
DROP POLICY IF EXISTS "disbursement_admin_all"       ON public.disbursement_requests;
DROP POLICY IF EXISTS "payout_account_admin_all"     ON public.host_payout_accounts;

CREATE POLICY "host_wallet_admin_all"
  ON public.host_wallets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "wallet_tx_admin_all"
  ON public.wallet_transactions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "disbursement_admin_all"
  ON public.disbursement_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "payout_account_admin_all"
  ON public.host_payout_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
