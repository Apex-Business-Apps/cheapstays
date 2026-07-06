import { useEffect, useState, type ReactNode } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PendingBooking {
  id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  total_php: number;
  created_at: string;
  listings: { title: string } | null;
}

interface UrgentTicket {
  id: string;
  ticket_num: number;
  subject: string;
  status: string;
  priority: string;
  escalated: boolean;
  created_at: string;
}

interface DisbursementIssue {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  retry_count: number;
  requested_at: string;
  failure_reason: string | null;
}

function AlertSection({
  title,
  count,
  badgeColor,
  children,
}: {
  title: string;
  count: number;
  badgeColor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count > 0 && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${badgeColor}`}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function AlertsTab({
  onSelectBooking,
}: {
  onSelectBooking: (id: string) => void;
}) {
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [urgentTickets, setUrgentTickets] = useState<UrgentTicket[]>([]);
  const [disbursementIssues, setDisbursementIssues] = useState<DisbursementIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from("bookings")
        .select("id,guest_id,check_in,check_out,total_php,created_at,listings(title)")
        .eq("flow_state", "requested")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("support_tickets")
        .select("id,ticket_num,subject,status,priority,escalated,created_at")
        .or("escalated.eq.true,priority.eq.urgent")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("disbursement_requests")
        .select("id,amount,status,payout_method,retry_count,requested_at,failure_reason")
        .in("status", ["pending", "failed"])
        .order("requested_at", { ascending: false })
        .limit(50),
    ]).then(([bookRes, ticketRes, disbRes]) => {
      setPendingBookings((bookRes.data ?? []) as unknown as PendingBooking[]);
      setUrgentTickets((ticketRes.data ?? []) as unknown as UrgentTicket[]);
      setDisbursementIssues((disbRes.data ?? []) as unknown as DisbursementIssue[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const allClear =
    pendingBookings.length === 0 &&
    urgentTickets.length === 0 &&
    disbursementIssues.length === 0;

  if (allClear) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">No alerts — everything looks good</p>
        <p className="text-xs text-muted-foreground">
          No pending confirmations, urgent tickets, or disbursement issues.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending confirmations */}
      <AlertSection
        title="Pending confirmations"
        count={pendingBookings.length}
        badgeColor="bg-amber-500"
      >
        {pendingBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear</p>
        ) : (
          <div className="space-y-2">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {b.listings?.title ?? "Unknown listing"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.check_in} → {b.check_out} · ₱{b.total_php.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(b.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 min-h-[44px]"
                  onClick={() => onSelectBooking(b.id)}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        )}
      </AlertSection>

      {/* Urgent support issues */}
      <AlertSection
        title="Urgent support issues"
        count={urgentTickets.length}
        badgeColor="bg-red-500"
      >
        {urgentTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear</p>
        ) : (
          <div className="space-y-2">
            {urgentTickets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    #{t.ticket_num} — {t.subject}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {t.escalated && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Escalated
                      </Badge>
                    )}
                    {t.priority === "urgent" && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(parseISO(t.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Link
                  to="/admin/tickets"
                  className="shrink-0 text-xs text-primary hover:underline min-h-[44px] flex items-center"
                >
                  View ticket
                </Link>
              </div>
            ))}
          </div>
        )}
      </AlertSection>

      {/* Disbursement issues */}
      <AlertSection
        title="Disbursement issues"
        count={disbursementIssues.length}
        badgeColor="bg-amber-500"
      >
        {disbursementIssues.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear</p>
        ) : (
          <div className="space-y-2">
            {disbursementIssues.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">₱{d.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {d.payout_method.replace(/_/g, " ")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 capitalize ${
                        d.status === "failed"
                          ? "border-red-400 text-red-500"
                          : "border-amber-400 text-amber-500"
                      }`}
                    >
                      {d.status}
                    </Badge>
                    {d.retry_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {d.retry_count} {d.retry_count === 1 ? "retry" : "retries"}
                      </span>
                    )}
                  </div>
                  {d.failure_reason && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {d.failure_reason}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(d.requested_at), { addSuffix: true })}
                  </p>
                </div>
                <Link
                  to="/admin/disbursements"
                  className="shrink-0 text-xs text-primary hover:underline min-h-[44px] flex items-center"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </AlertSection>
    </div>
  );
}
