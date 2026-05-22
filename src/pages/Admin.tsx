import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { AppRole } from "@/lib/rbac";
import { Seo } from "@/components/Seo";
import {
  RefreshCw, Users, TicketIcon, ShieldCheck, Clock,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  ExternalLink, MessageSquare,
} from "lucide-react";

type AuditRow = {
  id: string;
  target_user_id: string;
  actor_user_id: string;
  role: AppRole;
  action: "granted" | "revoked";
  created_at: string;
};
type SupportTicket = {
  id: string;
  ticket_num: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  escalated: boolean;
  created_at: string;
};
type TicketMessage = {
  id: string;
  sender: string;
  content: string;
  created_at: string;
};
type UserRoleRow = { id: string; user_id: string; role: AppRole };
type ProfileRow = { user_id: string; display_name: string | null };
type HostProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  verification_status: string;
  id_photo_url: string | null;
  selfie_url: string | null;
  created_at: string;
};
type UserView = { userId: string; displayName: string; initials: string; roles: AppRole[] };

const MANAGED_ROLES: AppRole[] = ["admin", "host", "member"];
type TicketStatus = "open" | "pending" | "resolved" | "closed" | "escalated";
const TICKET_STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed", "escalated"];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "destructive",
  normal: "secondary",
  low: "outline",
};
const SENDER_LABEL: Record<string, string> = {
  user: "User",
  ai: "AI",
  admin: "Admin",
  system: "System",
};

function StatCard({
  label,
  value,
  icon: Icon,
  urgent,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  urgent?: boolean;
  onClick?: () => void;
}) {
  const active = urgent && value > 0;
  return (
    <Card
      className={`p-4 flex items-center gap-3 transition-colors ${active ? "border-destructive/50" : ""} ${onClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={onClick}
    >
      <div className={`p-2 rounded-md ${active ? "bg-destructive/10" : "bg-muted"}`}>
        <Icon className={`h-4 w-4 ${active ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p className={`text-xl font-semibold leading-none ${active ? "text-destructive" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </Card>
  );
}

export default function Admin() {
  const { roles, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("tickets");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [hostProfiles, setHostProfiles] = useState<HostProfile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Map<string, TicketMessage[]>>(new Map());
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchDashboard = useCallback(async () => {
    const [auditRes, ticketRes, rolesRes, profilesRes, hostRes] = await Promise.all([
      supabase
        .from("role_audit_log")
        .select("id,target_user_id,actor_user_id,role,action,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("support_tickets")
        .select("id,ticket_num,subject,status,priority,category,escalated,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("user_roles").select("id,user_id,role"),
      supabase.from("profiles").select("user_id,display_name").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("host_profiles")
        .select("id,user_id,display_name,verification_status,id_photo_url,selfie_url,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (auditRes.error || ticketRes.error || rolesRes.error || profilesRes.error) {
      toast.error("Failed to load dashboard data.");
      return;
    }

    setAudit((auditRes.data as AuditRow[]) ?? []);
    setTickets((ticketRes.data as SupportTicket[]) ?? []);
    setUserRoles((rolesRes.data as UserRoleRow[]) ?? []);
    setProfiles((profilesRes.data as ProfileRow[]) ?? []);
    setHostProfiles((hostRes.data as HostProfile[]) ?? []);
  }, []);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    fetchDashboard();
  }, [fetchDashboard, roles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
    toast.success("Refreshed.");
  };

  const expandTicket = async (ticketId: string) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }
    setExpandedTicketId(ticketId);
    if (ticketMessages.has(ticketId)) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from("support_messages")
      .select("id,sender,content,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (data) {
      setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
    }
    setLoadingMessages(false);
  };

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.user_id, p.display_name ?? p.user_id.slice(0, 8));
    return map;
  }, [profiles]);

  const users = useMemo<UserView[]>(() => {
    const roleMap = new Map<string, Set<AppRole>>();
    for (const row of userRoles) {
      if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, new Set());
      roleMap.get(row.user_id)?.add(row.role);
    }
    return profiles.map((p) => {
      const assignedRoles = Array.from(roleMap.get(p.user_id) ?? new Set(["user" as AppRole]));
      const label = p.display_name?.trim() || p.user_id;
      const initials =
        label.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
      return { userId: p.user_id, displayName: label, initials, roles: assignedRoles };
    });
  }, [profiles, userRoles]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.displayName.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q));
  }, [users, userSearch]);

  const filteredTickets = useMemo(() => {
    let result = tickets;
    if (ticketFilter === "escalated") result = tickets.filter((t) => t.escalated);
    else if (ticketFilter !== "all") result = tickets.filter((t) => t.status === ticketFilter);
    // Escalated first, then by priority
    return [...result].sort((a, b) => {
      if (a.escalated && !b.escalated) return -1;
      if (!a.escalated && b.escalated) return 1;
      return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    });
  }, [tickets, ticketFilter]);

  const pendingHosts = useMemo(
    () => hostProfiles.filter((hp) => hp.verification_status === "pending" || hp.verification_status === "unverified"),
    [hostProfiles]
  );

  const processedHosts = useMemo(
    () => hostProfiles.filter((hp) => hp.verification_status !== "pending" && hp.verification_status !== "unverified"),
    [hostProfiles]
  );

  const stats = useMemo(
    () => ({
      totalUsers: profiles.length,
      openTickets: tickets.filter((t) => t.status === "open").length,
      escalated: tickets.filter((t) => t.escalated).length,
      pendingHosts: pendingHosts.length,
      roleChanges24h: audit.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86_400_000).length,
    }),
    [profiles, tickets, pendingHosts, audit]
  );

  const auditByDate = useMemo(() => {
    const groups = new Map<string, AuditRow[]>();
    for (const r of audit) {
      const key = new Date(r.created_at).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return groups;
  }, [audit]);

  const setRole = async (userId: string, role: AppRole, grant: boolean) => {
    setBusy(true);
    try {
      const { error } = grant
        ? await supabase.from("user_roles").insert({ user_id: userId, role })
        : await supabase.from("user_roles").delete().match({ user_id: userId, role });
      if (error) throw error;
      await fetchDashboard();
      toast.success(`${grant ? "Granted" : "Revoked"} ${role}.`);
    } catch {
      toast.error(`Could not ${grant ? "grant" : "revoke"} ${role}.`);
    } finally {
      setBusy(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) throw error;
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
      toast.success(`Ticket → ${status}.`);
    } catch {
      toast.error("Could not update ticket.");
    } finally {
      setBusy(false);
    }
  };

  const verifyHost = async (profileId: string, status: "verified" | "rejected") => {
    setBusy(true);
    try {
      const { error } = await supabase.from("host_profiles").update({ verification_status: status }).eq("id", profileId);
      if (error) throw error;
      await fetchDashboard();
      toast.success(`Host ${status}.`);
    } catch {
      toast.error("Could not update host.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container py-20 text-sm text-muted-foreground">Loading…</div>;
  if (!roles.includes("admin"))
    return (
      <div className="container py-20 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Admin only</h1>
        <p className="text-muted-foreground mt-2">You don't have admin access.</p>
      </div>
    );

  return (
    <div>
      <Seo title="Admin Dashboard" description="CheapStays admin dashboard" path="/admin" />
      <div className="container py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Platform oversight — users, support tickets, host verifications, and role history.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats — clickable, navigate to relevant tab+filter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total users" value={stats.totalUsers} icon={Users}
            onClick={() => setActiveTab("users")} />
          <StatCard label="Open tickets" value={stats.openTickets} icon={TicketIcon} urgent
            onClick={() => { setActiveTab("tickets"); setTicketFilter("open"); }} />
          <StatCard label="Escalated" value={stats.escalated} icon={AlertTriangle} urgent
            onClick={() => { setActiveTab("tickets"); setTicketFilter("escalated"); }} />
          <StatCard label="Pending verifications" value={stats.pendingHosts} icon={Clock} urgent
            onClick={() => setActiveTab("hosts")} />
          <StatCard label="Role changes (24h)" value={stats.roleChanges24h} icon={ShieldCheck}
            onClick={() => setActiveTab("audit")} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="tickets" className="gap-1.5">
              Tickets
              {stats.openTickets > 0 && (
                <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-px leading-none">
                  {stats.openTickets}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="hosts" className="gap-1.5">
              Hosts
              {stats.pendingHosts > 0 && (
                <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-px leading-none">
                  {stats.pendingHosts}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          {/* ── Tickets ── */}
          <TabsContent value="tickets" className="mt-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", "open", "pending", "escalated", "resolved", "closed"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={ticketFilter === f ? "default" : "outline"}
                  onClick={() => setTicketFilter(f)}
                  className="capitalize h-7 text-xs"
                >
                  {f}
                  {f === "open" && stats.openTickets > 0 && ` (${stats.openTickets})`}
                  {f === "escalated" && stats.escalated > 0 && ` (${stats.escalated})`}
                </Button>
              ))}
            </div>

            {filteredTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No tickets matching this filter.</p>
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((t) => {
                  const isExpanded = expandedTicketId === t.id;
                  const messages = ticketMessages.get(t.id) ?? [];
                  return (
                    <Card key={t.id} className={`overflow-hidden ${t.escalated ? "border-destructive/40" : ""}`}>
                      {/* Row */}
                      <div
                        className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => expandTicket(t.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="font-mono text-xs text-muted-foreground">#{t.ticket_num}</span>
                            {t.escalated && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Escalated</Badge>
                            )}
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
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded thread */}
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
                              <div
                                key={msg.id}
                                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                                  msg.sender === "user"
                                    ? "bg-muted ml-0"
                                    : msg.sender === "admin"
                                    ? "bg-primary/10 ml-auto text-right"
                                    : msg.sender === "ai"
                                    ? "bg-secondary/40 mx-auto text-center"
                                    : "bg-muted/50 mx-auto text-center text-muted-foreground italic"
                                }`}
                              >
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">
                                  {SENDER_LABEL[msg.sender] ?? msg.sender} · {new Date(msg.created_at).toLocaleTimeString()}
                                </p>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
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
          </TabsContent>

          {/* ── Users ── */}
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
                {filteredUsers.map((user) => (
                  <Card key={user.userId} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{user.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.displayName}</p>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {user.roles.map((r) => (
                            <Badge
                              key={r}
                              variant={r === "admin" ? "default" : r === "host" ? "secondary" : "outline"}
                              className="text-[10px] h-4 px-1.5"
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{user.userId.slice(0, 16)}…</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {MANAGED_ROLES.map((role) => {
                        const hasRole = user.roles.includes(role);
                        return (
                          <Button
                            key={role}
                            size="sm"
                            variant={hasRole ? "default" : "outline"}
                            disabled={busy}
                            onClick={() => setRole(user.userId, role, !hasRole)}
                            className="text-xs h-7 capitalize"
                          >
                            {hasRole ? `Revoke ${role}` : `Grant ${role}`}
                          </Button>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Hosts ── */}
          <TabsContent value="hosts" className="mt-6 space-y-6">
            {pendingHosts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Awaiting review ({pendingHosts.length})
                </p>
                <div className="grid gap-3">
                  {pendingHosts.map((hp) => (
                    <Card key={hp.id} className="p-4 border-amber-500/40">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{hp.display_name ?? nameMap.get(hp.user_id) ?? hp.user_id.slice(0, 8)}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{hp.user_id.slice(0, 16)}…</p>
                          <p className="text-xs text-muted-foreground">Applied {new Date(hp.created_at).toLocaleDateString()}</p>
                          {/* Verification documents */}
                          <div className="flex gap-3 mt-2 flex-wrap">
                            {hp.id_photo_url ? (
                              <a
                                href={hp.id_photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" /> ID Photo
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No ID photo</span>
                            )}
                            {hp.selfie_url ? (
                              <a
                                href={hp.selfie_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" /> Selfie
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No selfie</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={() => verifyHost(hp.id, "verified")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={busy} onClick={() => verifyHost(hp.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {processedHosts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">All hosts</p>
                <div className="grid gap-2">
                  {processedHosts.map((hp) => (
                    <Card key={hp.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-sm">{hp.display_name ?? nameMap.get(hp.user_id) ?? hp.user_id.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{hp.user_id.slice(0, 16)}…</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(hp.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={hp.verification_status === "verified" ? "default" : "destructive"}>
                        {hp.verification_status}
                      </Badge>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {hostProfiles.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">No host profiles yet.</p>
            )}
          </TabsContent>

          {/* ── Audit Log ── */}
          <TabsContent value="audit" className="mt-6 space-y-6">
            {audit.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">No role changes recorded.</p>
            )}
            {[...auditByDate.entries()].map(([date, rows]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{date}</p>
                <div className="space-y-1">
                  {rows.map((r) => (
                    <Card key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        {r.action === "granted"
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <span className={r.action === "granted" ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                          {r.action}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{r.role}</Badge>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="font-medium text-sm">{nameMap.get(r.target_user_id) ?? r.target_user_id.slice(0, 8)}</span>
                        <span className="text-muted-foreground text-xs hidden sm:inline">
                          by {nameMap.get(r.actor_user_id) ?? r.actor_user_id?.slice(0, 8) ?? "system"}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {new Date(r.created_at).toLocaleTimeString()}
                      </span>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
