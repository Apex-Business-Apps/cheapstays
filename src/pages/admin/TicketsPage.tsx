// src/pages/admin/TicketsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import type { SupportTicket, TicketMessage, TicketStatus } from "./types";
import { PRIORITY_VARIANT, TICKET_STATUSES, SENDER_LABEL } from "./types";

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [grantingHost, setGrantingHost] = useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState("all");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Map<string, TicketMessage[]>>(new Map());
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Map<string, string>>(new Map());
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("support_tickets")
      .select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
      .order("created_at", { ascending: false }).limit(200);
    setTickets((data as SupportTicket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    openTickets: tickets.filter((t) => t.status === "open" && !t.escalated).length,
    escalated: tickets.filter((t) => t.escalated).length,
  }), [tickets]);

  const filtered = useMemo(() =>
    tickets.filter((t) =>
      ticketFilter === "all" ? true : ticketFilter === "escalated" ? t.escalated : t.status === ticketFilter),
    [tickets, ticketFilter]);

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

  const sendAdminReply = async (ticketId: string) => {
    const content = replyInputs.get(ticketId)?.trim();
    if (!content) return;
    setSendingReply(ticketId);
    try {
      const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, sender: "admin", author_user_id: user?.id, content });
      if (error) throw error;
      setReplyInputs((prev) => { const next = new Map(prev); next.set(ticketId, ""); return next; });
      const { data } = await supabase.from("support_messages").select("id,sender,content,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      toast.success("Reply sent.");
    } catch { toast.error("Could not send reply."); }
    finally { setSendingReply(null); }
  };

  return (
    <>
      <Seo title="Support Tickets · CheapStays Admin" description="Manage support tickets." path="/admin/tickets" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Support Tickets</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "open", "pending", "escalated", "resolved", "closed"] as const).map((f) => (
              <Button key={f} size="sm" variant={ticketFilter === f ? "default" : "outline"}
                onClick={() => setTicketFilter(f)} className="capitalize h-7 text-xs">
                {f}
                {f === "open"      && stats.openTickets > 0 && ` (${stats.openTickets})`}
                {f === "escalated" && stats.escalated > 0   && ` (${stats.escalated})`}
              </Button>
            ))}
          </div>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6">No tickets matching this filter.</p> : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                const messages   = ticketMessages.get(t.id) ?? [];
                return (
                  <Card key={t.id} className={`overflow-hidden ${t.escalated ? "border-destructive/40" : ""}`}>
                    <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => expandTicket(t.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="font-mono text-xs text-muted-foreground">#{t.ticket_num}</span>
                          {t.escalated && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Escalated</Badge>}
                          {t.priority && t.priority !== "normal" && <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"} className="text-[10px] h-4 px-1.5 capitalize">{t.priority}</Badge>}
                          {t.category && <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{t.category.replace(/_/g, " ")}</Badge>}
                        </div>
                        <p className="font-medium text-sm">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Select value={t.status} onValueChange={(val) => updateTicketStatus(t.id, val as TicketStatus)} disabled={busy}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}</SelectContent>
                        </Select>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-3">
                        {loadingMessages && !ticketMessages.has(t.id) ? (
                          <p className="text-xs text-muted-foreground">Loading messages…</p>
                        ) : messages.length === 0 ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> No messages yet.</p>
                        ) : (
                          messages.map((msg) => (
                            <div key={msg.id} className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${msg.sender === "user" ? "bg-muted ml-0" : msg.sender === "admin" ? "bg-primary/10 ml-auto text-right" : msg.sender === "ai" ? "bg-secondary/40 mx-auto text-center" : "bg-muted/50 mx-auto text-center text-muted-foreground italic"}`}>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">{SENDER_LABEL[msg.sender] ?? msg.sender} · {new Date(msg.created_at).toLocaleTimeString()}</p>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          ))
                        )}
                        {t.category === "host_verification" && t.status !== "resolved" && (
                          <div className="flex items-center gap-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground flex-1">This is a host verification request.</span>
                            <Button size="sm" className="h-8 text-xs shrink-0" disabled={grantingHost === t.id} onClick={() => grantHostRole(t.id)}>
                              {grantingHost === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve as Host"}
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                          <Input value={replyInputs.get(t.id) ?? ""} onChange={(e) => setReplyInputs((prev) => { const next = new Map(prev); next.set(t.id, e.target.value); return next; })}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminReply(t.id); } }}
                            placeholder="Reply to user…" className="h-8 text-xs flex-1" disabled={sendingReply === t.id} />
                          <Button size="sm" className="h-8 text-xs" disabled={!replyInputs.get(t.id)?.trim() || sendingReply === t.id} onClick={() => sendAdminReply(t.id)}>
                            {sendingReply === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
