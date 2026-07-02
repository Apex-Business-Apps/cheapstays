// src/pages/admin/ApplicationsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HostApplicationReview } from "@/features/admin/HostApplicationReview";
import { submitHostApplicationDecision } from "@/features/admin/adminHostApproval.service";
import { Seo } from "@/components/Seo";
import type { SupportTicket, TicketMessage, HostApp, TicketStatus } from "./types";

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [hostApps, setHostApps] = useState<HostApp[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [grantingHost, setGrantingHost] = useState<string | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Map<string, TicketMessage[]>>(new Map());
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [appsRes, ticketRes] = await Promise.all([
      supabase.from("host_applications")
        .select("id,user_id,full_legal_name,phone,property_type,city,province,property_description,id_type,id_front_path,selfie_path,status,created_at")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("support_tickets")
        .select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
        .eq("category", "host_verification").order("created_at", { ascending: false }).limit(100),
    ]);
    setHostApps((appsRes.data as HostApp[]) ?? []);
    setTickets((ticketRes.data as SupportTicket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingVerificationTickets = useMemo(() =>
    tickets.filter((t) => t.status !== "resolved" && t.status !== "closed"),
    [tickets]);

  const expandTicket = useCallback(async (ticketId: string) => {
    if (expandedTicketId === ticketId) { setExpandedTicketId(null); return; }
    setExpandedTicketId(ticketId);
    if (!ticketMessages.has(ticketId)) {
      setLoadingMessages(true);
      const { data } = await supabase.from("support_messages")
        .select("id,sender,content,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      setLoadingMessages(false);
    }
  }, [expandedTicketId, ticketMessages]);

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) throw error;
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
    } catch { toast.error("Could not update ticket status."); }
    finally { setBusy(false); }
  };

  const grantHostRole = async (ticketId: string) => {
    setGrantingHost(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("approve-host-via-ticket", { body: { ticket_id: ticketId } });
      if (error) {
        let msg = error.message;
        try { const body = await (error as { context?: Response }).context?.json() as { error?: string } | undefined; if (body?.error) msg = body.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: "resolved" } : t));
      toast.success(data?.already_host ? "User already a host — ticket resolved." : "Host approved and ticket resolved.");
    } catch (err) { toast.error(`Approval failed: ${(err as Error).message}`); }
    finally { setGrantingHost(null); }
  };

  const handleAppDecision = async (appId: string, userId: string, approve: boolean, reason?: string) => {
    setBusy(true);
    try {
      await submitHostApplicationDecision({ applicationId: appId, targetUserId: userId, reviewerId: user?.id, approve, reason });
      await load();
      toast.success(approve ? "Application approved and host status confirmed." : "Application rejected.");
    } catch (err) { toast.error(`Failed: ${(err as Error).message}`); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Seo title="Applications · CheapStays Admin" description="Host application review." path="/admin/applications" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Applications</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-8">
          {pendingVerificationTickets.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Verification requests <span className="text-muted-foreground font-normal ml-2 text-sm">via Support chat</span></h2>
              {pendingVerificationTickets.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                const messages = ticketMessages.get(t.id) ?? [];
                return (
                  <Card key={t.id} className="overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">#{t.ticket_num}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">Host Verification</Badge>
                        </div>
                        <p className="font-medium text-sm">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => expandTicket(t.id)}>{isExpanded ? "Hide" : "View details"}</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateTicketStatus(t.id, "closed")} disabled={busy}>Dismiss</Button>
                        <Button size="sm" className="h-8 text-xs" onClick={() => grantHostRole(t.id)} disabled={grantingHost === t.id}>
                          {grantingHost === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Approve as Host
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-2">
                        {loadingMessages && !ticketMessages.has(t.id) ? (
                          <p className="text-xs text-muted-foreground">Loading messages…</p>
                        ) : messages.filter((m) => m.sender === "user").length === 0 ? (
                          <p className="text-xs text-muted-foreground">No applicant messages found.</p>
                        ) : (
                          messages.filter((m) => m.sender === "user").map((msg) => (
                            <div key={msg.id} className="text-sm bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">{msg.content}</div>
                          ))
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
          <HostApplicationReview hostApps={hostApps} onDecision={handleAppDecision} />
        </div>
      )}
    </>
  );
}
