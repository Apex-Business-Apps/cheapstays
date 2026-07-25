-- ============================================================
-- Public RPC: get_stay_voucher_batch_stock
--
-- Returns per-batch "sold or held" counts (paid purchases + pending
-- purchases created in the last 30 minutes) so the frontend can render
-- a sold-out state on cards and disable the purchase button before
-- the buyer even hits Buy. Mirrors the server-side stock check in
-- the stay-voucher-checkout edge function.
--
-- SECURITY DEFINER because stay_voucher_purchases RLS restricts SELECT
-- to admins. This RPC returns only aggregate counts (no PII), safe
-- for anon reads.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_stay_voucher_batch_stock(p_batch_ids UUID[])
RETURNS TABLE(batch_id UUID, sold_or_held INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.batch_id,
    COALESCE(SUM(p.quantity)::INT, 0) AS sold_or_held
  FROM public.stay_voucher_purchases p
  WHERE p.batch_id = ANY(p_batch_ids)
    AND (
      p.payment_status = 'paid'
      OR (p.payment_status = 'pending' AND p.created_at >= now() - INTERVAL '30 minutes')
    )
  GROUP BY p.batch_id;
$$;

REVOKE ALL ON FUNCTION public.get_stay_voucher_batch_stock(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stay_voucher_batch_stock(UUID[]) TO anon, authenticated;
