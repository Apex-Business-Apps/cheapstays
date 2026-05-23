import { useCallback, useEffect, useMemo, useState } from "react";
import { format, eachDayOfInterval, parseISO, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HostApplicationReview, type HostApp } from "@/features/admin/HostApplicationReview";
import { submitHostApplicationDecision } from "@/features/admin/adminHostApproval.service";
import type { AppRole } from "@/lib/rbac";
import { Seo } from "@/components/Seo";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, MessageSquare } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Booking = {
  id: string; listing_id: string; guest_id: string; host_id: string;
  check_in: string; check_out: string; status: string; total_php: number; created_at: string;
};
type SupportTicket = {
  id: string; ticket_num: number; subject: string; status: string;
  priority: string; category: string; escalated: boolean; created_at: string;
  user_id: string;
};
type TicketMessage = { id: string; sender: string; content: string; created_at: string };
type TicketStatus  = "open" | "pending" | "resolved" | "closed" | "escalated";
type UserRoleRow   = { id: string; user_id: string; role: AppRole };
type ProfileRow    = { user_id: string; display_name: string | null };
type AuditRow      = {
  id: string; command_id: string; command_source: string;
  operation: string; target_user_id: string; reason_code: string;
  before_state: Record<string, unknown>; after_state: Record<string, unknown>;
  executed_by: string | null; created_at: string;
};

type UserView = { userId: string; displayName: string; initials: string; roles: AppRole[] };
const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500",
  pending:   "bg-amber-400",
  cancelled: "bg-red-400",
  completed: "bg-blue-400",
  no_show:   "bg-gray-400",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high:   "secondary",
  normal: "outline",
  low:    "outline",
};

const TICKET_STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed", "escalated"];

const SENDER_LABEL: Record<string, string> = {
  user:   "User",
  admin:  "Admin",
  ai:     "AI Assistant",
  system: "System",
};

// ─── Booking Calendar ─────────────────────────────────────────────────────────

function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  function bookingsOnDay(day: Date) {
    return bookings.filter((b) => {
      const ci = parseISO(b.check_in);
      const co = parseISO(b.check_out);
      return day >= ci && day < co;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            {status}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map((day) => {
          const bks = bookingsOnDay(day);
          return (
            <div key={day.toISOString()} className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs">
              <span className={`text-[10px] font-medium ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {bks.slice(0, 3).map((b) => (
                  <span key={b.id} className={`block h-1.5 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} title={`${b.status} · ₱${b.total_php}`} />
                ))}
                {bks.length > 3 && <span className="text-[9px] text-muted-foreground">+{bks.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 pt-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This month</p>
        {bookings
          .filter((b) => {
            const ci = parseISO(b.check_in);
            return ci >= startOfMonth(month) && ci <= endOfMonth(month);
          })
          .sort((a, b) => a.check_in.localeCompare(b.check_in))
          .slice(0, 20)
          .map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />
                <span>{format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{b.status}</Badge>
                <span className="text-muted-foreground text-xs">₱{b.total_php.toLocaleString()}</span>
              </div>
            </div>
          ))}
        {bookings.filter((b) => {
          const ci = parseISO(b.check_in);
          return ci >= startOfMonth(month) && ci <= endOfMonth(month);
        }).length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No bookings this month.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function Admin() {
  const { user, roles, loading } = useAuth();
  const [busy, setBusy]                   = useState(false);
  const [grantingHost, setGrantingHost]   = useState<string | null>(null);
  const [tickets, setTickets]             = useState<SupportTicket[]>([]);
  const [bookings, setBookings]           = useState<Booking[]>([]);
  const [userRoles, setUserRoles]         = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles]           = useState<ProfileRow[]>([]);
  const [hostApps, setHostApps]           = useState<HostApp[]>([]);
  const [auditLog, setAuditLog]           = useState<AuditRow[]>([]);
  const [userSearch, setUserSearch]       = useState("");
  const [ticketFilter, setTicketFilter]   = useState("all");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages]     = useState<Map<string, TicketMessage[]>>(new Map());
  const [loadingMessages, setLoadingMessages]   = useState(false);
  const [replyInputs, setReplyInputs]           = useState<Map<string, string>>(new Map());
  const [sendingReply, setSendingReply]         = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [ticketRes, bookingRes, rolesRes, profilesRes, appsRes, auditRes] = await Promise.all([
      supabase.from("support_tickets")
        .select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("bookings")
        .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at")
        .order("check_in", { ascending: false }).limit(300),
      supabase.from("user_roles").select("id,user_id,role").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,display_name").limit(200),
      supabase.from("host_applications")
        .select("id,user_id,full_legal_name,phone,property_type,city,province,property_description,id_type,id_front_path,selfie_path,status,created_at")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("role_mutation_audit")
        .select("id,command_id,command_source,operation,target_user_id,reason_code,before_state,after_state,executed_by,created_at")
        .order("created_at", { ascending: false }).limit(100),
    ]);

    if (ticketRes.error || bookingRes.error || rolesRes.error) {
      toast.error("Failed to load some admin data.");
    }

    setTickets((ticketRes.data as SupportTicket[]) ?? []);
    setBookings((bookingRes.data as Booking[]) ?? []);
    setUserRoles((rolesRes.data as UserRoleRow[]) ?? []);
    setProfiles((profilesRes.data as ProfileRow[]) ?? []);
    setHostApps((appsRes.data as HostApp[]) ?? []);
    setAuditLog((auditRes.data as unknown as AuditRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    fetchAll();
  }, [fetchAll, roles]);

  const users = useMemo<UserView[]>(() => {
    const roleMap = new Map<string, Set<AppRole>>();
    for (const row of userRoles) {
      if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, new Set());
      roleMap.get(row.user_id)?.add(row.role);
    }
    return profiles.map((p) => {
      const assigned = Array.from(roleMap.get(p.user_id) ?? new Set<AppRole>(["user"]));
      const label    = p.display_name?.trim() || p.user_id.slice(0, 8);
      const initials = label.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
      return { userId: p.user_id, displayName: label, initials, roles: assigned as AppRole[] };
    });
  }, [profiles, userRoles]);

  const stats = useMemo(() => ({
    openTickets: tickets.filter((t) => t.status === "open" && !t.escalated).length,
    escalated:   tickets.filter((t) => t.escalated).length,
  }), [tickets]);

  const filteredTickets = useMemo(() =>
    tickets.filter((t) =>
      ticketFilter === "all"      ? true :
      ticketFilter === "escalated" ? t.escalated :
      t.status === ticketFilter
    ), [tickets, ticketFilter]);

  const filteredUsers = useMemo(() =>
    userSearch.trim()
      ? users.filter((u) =>
          u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.userId.includes(userSearch))
      : users,
    [users, userSearch]);

  async function handleAppDecision(appId: string, userId: string, approve: boolean, reason?: string) {
    setBusy(true);
    try {
      await submitHostApplicationDecision({
        applicationId: appId,
        targetUserId: userId,
        reviewerId: user?.id,
        approve,
        reason,
      });
      await fetchAll();
      toast.success(approve ? "Application approved and host status confirmed." : "Application rejected.");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) throw error;
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
    } catch {
      toast.error("Could not update ticket status.");
    } finally {
      setBusy(false);
    }
  };

  const grantHostRole = async (ticketId: string, targetUserId: string) => {
    setGrantingHost(ticketId);
    try {
      const { error } = await supabase.functions.invoke("grant-host-role", {
        body: { target_user_id: targetUserId, operation: "grant", reason_code: "host-verified-via-support-ticket" },
      });
      if (error) throw error;
      await updateTicketStatus(ticketId, "resolved");
      toast.success("Host role granted and ticket resolved.");
    } catch (err) {
      toast.error(`Failed to grant host role: ${(err as Error).message}`);
    } finally {
      setGrantingHost(null);
    }
  };

  const expandTicket = useCallback(async (ticketId: string) => {
    if (expandedTicketId === ticketId) { setExpandedTicketId(null); return; }
    setExpandedTicketId(ticketId);
    if (!ticketMessages.has(ticketId)) {
      setLoadingMessages(true);
      const { data } = await supabase
        .from("support_messages")
        .select("id,sender,content,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      setLoadingMessages(false);
    }
  }, [expandedTicketId, ticketMessages]);

  const sendAdminReply = async (ticketId: string) => {
    const content = replyInputs.get(ticketId)?.trim();
    if (!content) return;
    setSendingReply(ticketId);
    try {
      const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, sender: "admin", author_user_id: user?.id, content });
      if (error) throw error;
      setReplyInputs((prev) => { const next = new Map(prev); next.set(ticketId, ""); return next; });
      const { data } = await supabase
        .from("support_messages").select("id,sender,content,created_at")
        .eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      toast.success("Reply sent.");
    } catch {
      toast.error("Could not send reply.");
    } finally {
      setSendingReply(null);
    }
  };

  const pendingApps  = hostApps.filter((a) => a.status === "pending" || a.status === "manual_review");
  const pendingVerificationTickets = useMemo(() =>
    tickets.filter((t) => t.category === "host_verification" && t.status !== "resolved" && t.status !== "closed"),
    [tickets]
  );
  const totalPendingApprovals = pendingApps.length + pendingVerificationTickets.length;

  if (loading) return <div className="container py-20 text-sm text-muted-foreground">Loading…</div>;
  if (!roles.includes("admin")) return (
    <div className="container py-20 max-w-md text-center">
      <h1 className="text-2xl font-semibold">Admin only</h1>
      <p className="text-muted-foreground mt-2">You don't have admin access.</p>
    </div>
  );

  return (
    <div>
      <Seo title="CheapStays Admin" description="Admin dashboard." path="/admin" />
      <div className="container py-10 max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>{totalPendingApprovals} pending host {totalPendingApprovals === 1 ? "application" : "applications"}</span>
            <span>·</span>
            <span>{bookings.filter((b) => b.status === "confirmed").length} active bookings</span>
            <span>·</span>
            <span>{tickets.filter((t) => t.status === "open" || t.escalated).length} open tickets</span>
          </div>
        </div>

        <Tabs defaultValue="applications">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="applications" className="relative">
              Applications
              {totalPendingApprovals > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {totalPendingApprovals}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Users &amp; Roles</TabsTrigger>
            <TabsTrigger value="tickets">
              Support
              {stats.escalated > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {stats.escalated}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          {/* ── HOST APPLICATIONS ── */}
          <TabsContent value="applications" className="space-y-8 pt-4">
            {pendingVerificationTickets.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold">
                  Verification requests
                  <span className="text-muted-foreground font-normal ml-2 text-sm">via Support chat</span>
                </h2>
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
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => expandTicket(t.id)}>
                            {isExpanded ? "Hide" : "View details"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateTicketStatus(t.id, "closed")} disabled={busy}>
                            Dismiss
                          </Button>
                          <Button size="sm" className="h-8 text-xs" onClick={() => grantHostRole(t.id, t.user_id)} disabled={grantingHost === t.id}>
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
                              <div key={msg.id} className="text-sm bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">
                                {msg.content}
                              </div>
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
          </TabsContent>

          {/* ── BOOKINGS CALENDAR ── */}
          <TabsContent value="bookings" className="pt-4">
            <BookingCalendar bookings={bookings} />
          </TabsContent>

          {/* ── USERS LIST ── */}
          <TabsContent value="users" className="mt-6 space-y-4">
            <Input
              placeholder="Search by name or user ID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-sm h-8 text-sm"
            />
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No users found.</p>
            ) : (
              <div className="grid gap-2">
                {filteredUsers.map((u) => (
                  <Card key={u.userId} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{u.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{u.displayName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{u.userId.slice(0, 16)}…</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : r === "host" ? "secondary" : "outline"} className="text-[10px] capitalize">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── USERS & ROLES ── */}
          <TabsContent value="roles" className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Role changes are read-only here. Host status is granted only through pending host application approvals.
            </p>
            {users.map((u) => (
              <Card key={u.userId} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback>{u.initials}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium text-sm">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{u.userId.slice(0, 12)}…</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
                    </div>
                  </div>
                </div>

              </Card>
            ))}
          </TabsContent>

          {/* ── SUPPORT TICKETS ── */}
          <TabsContent value="tickets" className="mt-6 space-y-4">
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

            {filteredTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No tickets matching this filter.</p>
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((t) => {
                  const isExpanded = expandedTicketId === t.id;
                  const messages   = ticketMessages.get(t.id) ?? [];
                  return (
                    <Card key={t.id} className={`overflow-hidden ${t.escalated ? "border-destructive/40" : ""}`}>
                      <div
                        className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => expandTicket(t.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="font-mono text-xs text-muted-foreground">#{t.ticket_num}</span>
                            {t.escalated && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Escalated</Badge>}
                            {t.priority && t.priority !== "normal" && (
                              <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"} className="text-[10px] h-4 px-1.5 capitalize">
                                {t.priority}
                              </Badge>
                            )}
                            {t.category && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                                {t.category.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm">{t.subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Select value={t.status} onValueChange={(val) => updateTicketStatus(t.id, val as TicketStatus)} disabled={busy}>
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TICKET_STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-4 space-y-3">
                          {loadingMessages && !ticketMessages.has(t.id) ? (
                            <p className="text-xs text-muted-foreground">Loading messages…</p>
                          ) : messages.length === 0 ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5" /> No messages yet.
                            </p>
                          ) : (
                            messages.map((msg) => (
                              <div key={msg.id} className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                                msg.sender === "user"   ? "bg-muted ml-0" :
                                msg.sender === "admin"  ? "bg-primary/10 ml-auto text-right" :
                                msg.sender === "ai"     ? "bg-secondary/40 mx-auto text-center" :
                                                          "bg-muted/50 mx-auto text-center text-muted-foreground italic"
                              }`}>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">
                                  {SENDER_LABEL[msg.sender] ?? msg.sender} · {new Date(msg.created_at).toLocaleTimeString()}
                                </p>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            ))
                          )}
                          {t.category === "host_verification" && t.status !== "resolved" && (
                            <div className="flex items-center gap-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-muted-foreground flex-1">This is a host verification request.</span>
                              <Button size="sm" className="h-8 text-xs shrink-0"
                                disabled={grantingHost === t.id}
                                onClick={() => grantHostRole(t.id, t.user_id)}>
                                {grantingHost === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve as Host"}
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={replyInputs.get(t.id) ?? ""}
                              onChange={(e) => setReplyInputs((prev) => { const next = new Map(prev); next.set(t.id, e.target.value); return next; })}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminReply(t.id); } }}
                              placeholder="Reply to user…"
                              className="h-8 text-xs flex-1"
                              disabled={sendingReply === t.id}
                            />
                            <Button size="sm" className="h-8 text-xs"
                              disabled={!replyInputs.get(t.id)?.trim() || sendingReply === t.id}
                              onClick={() => sendAdminReply(t.id)}>
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
          </TabsContent>

          {/* ── AUDIT LOG ── */}
          <TabsContent value="audit" className="pt-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Immutable record of all privileged role mutations.</p>
            {auditLog.length === 0 && <p className="text-sm text-muted-foreground">No audit records yet.</p>}
            {auditLog.map((r) => (
              <Card key={r.id} className="p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    <Badge variant="outline" className="mr-2 text-[10px]">{r.command_source}</Badge>
                    <strong>{r.operation}</strong>
                    {" → "}<code className="bg-secondary px-1 rounded">{r.target_user_id.slice(0, 8)}</code>
                  </span>
                  <span className="text-muted-foreground">{format(parseISO(r.created_at), "dd MMM yyyy HH:mm")}</span>
                </div>
                <p className="text-muted-foreground">Reason: {r.reason_code} · Command: <code className="bg-secondary px-1 rounded text-[10px]">{r.command_id.slice(0, 28)}…</code></p>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
