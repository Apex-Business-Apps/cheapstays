import { useEffect, useState } from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Loader2, Check, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Request = {
  id: string;
  listing_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_php: number;
  guest_message: string | null;
  approval_deadline_at: string | null;
  created_at: string;
  flow_state: string;
  listings: { title: string } | null;
};

type Decision =
  | { kind: "approve"; bookingId: string; notes: string }
  | { kind: "decline"; bookingId: string; reason: string };

export function LongTermRequestsInbox({ hostId }: { hostId: string }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await sb.from("bookings")
        .select("id,listing_id,guest_id,check_in,check_out,nights,guests,total_php,guest_message,approval_deadline_at,created_at,flow_state,listings(title)")
        .eq("host_id", hostId)
        .eq("booking_flow", "request_booking")
        .in("flow_state", ["requested"])
        .order("approval_deadline_at", { ascending: true });
      if (cancelled) return;
      setRequests(
        ((data ?? []) as Record<string, unknown>[]).map((b) => ({
          ...b,
          listings: Array.isArray(b.listings) ? (b.listings[0] ?? null) : b.listings,
        })) as Request[],
      );
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [hostId]);

  async function runDecision(d: Decision) {
    setBusyId(d.bookingId);
    setPendingDecision(null);
    try {
      const fn = d.kind === "approve" ? "approve-long-term-request" : "decline-long-term-request";
      const body = d.kind === "approve"
        ? { booking_id: d.bookingId, host_notes: d.notes || undefined }
        : { booking_id: d.bookingId, reason: d.reason };

      const { error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== d.bookingId));
      toast({ title: d.kind === "approve" ? "Request approved" : "Request declined" });
    } catch (err) {
      let msg = (err as Error).message;
      try {
        const body = await (err as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: "Action failed", description: msg, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading long-term requests…
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No pending long-term requests. Short-term bookings (≤30 nights) are
        confirmed instantly and never appear here.
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((r) => {
          const deadline = r.approval_deadline_at ? parseISO(r.approval_deadline_at) : null;
          const overdue = deadline && deadline < new Date();
          return (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{r.listings?.title ?? "Listing"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(r.check_in), "MMM d")} → {format(parseISO(r.check_out), "MMM d, yyyy")}
                    {" · "} {r.nights} nights · {r.guests} guest{r.guests > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total ₱{r.total_php.toLocaleString()} · request received {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={overdue ? "destructive" : "secondary"} className="text-[10px]">
                    <Clock className="h-3 w-3 mr-1" />
                    {deadline
                      ? overdue
                        ? `Overdue ${formatDistanceToNow(deadline, { addSuffix: true })}`
                        : `Respond ${formatDistanceToNow(deadline, { addSuffix: true })}`
                      : "No deadline"}
                  </Badge>
                </div>
              </div>

              {r.guest_message && (
                <p className="text-sm bg-muted/30 rounded p-2">
                  "{r.guest_message}"
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm" variant="default"
                  disabled={busyId === r.id}
                  onClick={() => setPendingDecision({ kind: "approve", bookingId: r.id, notes: "" })}
                >
                  {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Approve
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={busyId === r.id}
                  onClick={() => setPendingDecision({ kind: "decline", bookingId: r.id, reason: "" })}
                >
                  <X className="h-4 w-4 mr-1" /> Decline
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={pendingDecision !== null} onOpenChange={(o) => !o && setPendingDecision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.kind === "approve" ? "Approve this long-term request?" : "Decline this long-term request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision?.kind === "approve"
                ? "The guest will be notified and prompted to complete payment. This action is logged in the booking history."
                : "The guest will be notified with your decline reason. The booking is closed and cannot be reopened."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision?.kind === "approve" && (
            <Textarea
              placeholder="Optional notes for the guest"
              value={pendingDecision.notes}
              onChange={(e) => setPendingDecision({ ...pendingDecision, notes: e.target.value })}
            />
          )}
          {pendingDecision?.kind === "decline" && (
            <Textarea
              placeholder="Reason (required, shared with the guest)"
              value={pendingDecision.reason}
              onChange={(e) => setPendingDecision({ ...pendingDecision, reason: e.target.value })}
            />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingDecision?.kind === "decline" && pendingDecision.reason.trim().length < 3}
              onClick={() => pendingDecision && runDecision(pendingDecision)}
            >
              {pendingDecision?.kind === "approve" ? "Approve" : "Decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
