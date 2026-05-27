-- ============================================================
-- Support Ticket Security Hardening Migration
--
-- Restricts standard authenticated users from directly mutating
-- any fields on the support_tickets table. Standard users must
-- only create tickets and insert messages, while all workflow
-- updates (escalation, priority, status changes) must happen
-- via the administrative dashboard (by admins) or service role.
-- ============================================================

-- 1. Drop the permissive update policy that allowed ticket owners to modify tickets directly
DROP POLICY IF EXISTS "Owner or admin can update ticket"
  ON public.support_tickets;

-- 2. Create a new, restricted update policy permitting only administrators to directly update tickets via SQL clients
CREATE POLICY "Admins can update tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Implement a critical-column protection trigger for support_tickets
CREATE OR REPLACE FUNCTION public.support_tickets_guard_critical_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role writes (edge functions) and admins are trusted
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Fail closed: reject standard client updates to any state or content columns
  IF NEW.status          IS DISTINCT FROM OLD.status          THEN RAISE EXCEPTION 'support_tickets.status must be updated via admin or service role'; END IF;
  IF NEW.priority        IS DISTINCT FROM OLD.priority        THEN RAISE EXCEPTION 'support_tickets.priority must be updated via admin or service role'; END IF;
  IF NEW.escalated       IS DISTINCT FROM OLD.escalated       THEN RAISE EXCEPTION 'support_tickets.escalated must be updated via admin or service role'; END IF;
  IF NEW.ai_response     IS DISTINCT FROM OLD.ai_response     THEN RAISE EXCEPTION 'support_tickets.ai_response is immutable for users'; END IF;
  IF NEW.ticket_num      IS DISTINCT FROM OLD.ticket_num      THEN RAISE EXCEPTION 'support_tickets.ticket_num is immutable'; END IF;
  IF NEW.user_id         IS DISTINCT FROM OLD.user_id         THEN RAISE EXCEPTION 'support_tickets.user_id is immutable'; END IF;
  IF NEW.subject         IS DISTINCT FROM OLD.subject         THEN RAISE EXCEPTION 'support_tickets.subject is immutable'; END IF;
  IF NEW.category        IS DISTINCT FROM OLD.category        THEN RAISE EXCEPTION 'support_tickets.category is immutable'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_guard_critical_columns_trg
  ON public.support_tickets;

CREATE TRIGGER support_tickets_guard_critical_columns_trg
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_guard_critical_columns();
