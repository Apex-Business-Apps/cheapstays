import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { AppRole } from "@/lib/rbac";
import { Seo } from "@/components/Seo";

type AuditRow = { id: string; target_user_id: string; role: AppRole; action: "granted" | "revoked"; created_at: string };
type Ticket = { id: string; ticket_num: number; subject: string; status: string; escalated: boolean; created_at: string };
type UserRoleRow = { id: string; user_id: string; role: AppRole };
type ProfileRow = { user_id: string; display_name: string | null };
type HostProfile = { id: string; user_id: string; business_name: string | null; verification_status: string; created_at: string };

type UserView = { userId: string; displayName: string; initials: string; roles: AppRole[] };
const MANAGED_ROLES: AppRole[] = ["admin", "host", "member"];

export default function Admin() {
  const { roles, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [hostProfiles, setHostProfiles] = useState<HostProfile[]>([]);

  const fetchDashboard = useCallback(async () => {
    const [auditRes, ticketRes, rolesRes, profilesRes, hostProfilesRes] = await Promise.all([
      supabase.from("role_audit_log").select("id,target_user_id,role,action,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("support_tickets").select("id,ticket_num,subject,status,escalated,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("user_roles").select("id,user_id,role").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,display_name").order("created_at", { ascending: false }).limit(200),
      supabase.from("host_profiles").select("id,user_id,business_name,verification_status,created_at").order("created_at", { ascending: false }).limit(100),
    ]);

    if (auditRes.error || ticketRes.error || rolesRes.error || profilesRes.error) {
      toast.error("Failed to load admin dashboard data.");
      return;
    }

    setAudit((auditRes.data as AuditRow[]) ?? []);
    setTickets((ticketRes.data as Ticket[]) ?? []);
    setUserRoles((rolesRes.data as UserRoleRow[]) ?? []);
    setProfiles((profilesRes.data as ProfileRow[]) ?? []);
    setHostProfiles((hostProfilesRes.data as HostProfile[]) ?? []);
  }, []);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    fetchDashboard();
  }, [fetchDashboard, roles]);

  const users = useMemo<UserView[]>(() => {
    const roleMap = new Map<string, Set<AppRole>>();
    for (const row of userRoles) {
      if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, new Set());
      roleMap.get(row.user_id)?.add(row.role);
    }

    return profiles.map((profile) => {
      const assignedRoles = Array.from(roleMap.get(profile.user_id) ?? new Set(["user" as AppRole]));
      const label = profile.display_name?.trim() || profile.user_id;
      const initials = label.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
      return { userId: profile.user_id, displayName: label, initials, roles: assignedRoles };
    });
  }, [profiles, userRoles]);

  const setRole = async (userId: string, role: AppRole, shouldHaveRole: boolean) => {
    setBusy(true);
    try {
      if (shouldHaveRole) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().match({ user_id: userId, role });
        if (error) throw error;
      }
      await fetchDashboard();
      toast.success(`${shouldHaveRole ? "Granted" : "Revoked"} ${role} role.`);
    } catch {
      toast.error(`Could not ${shouldHaveRole ? "grant" : "revoke"} ${role}.`);
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
      toast.error("Could not update host status.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container py-20">Loading…</div>;
  if (!roles.includes("admin")) return <div className="container py-20 max-w-md text-center"><h1 className="text-2xl font-semibold">Admin only</h1><p className="text-muted-foreground mt-2">You don't have admin access.</p></div>;

  return (
    <div>
      <Seo title="CheapStays Admin" description="Admin dashboard for role management, users, and support oversight." path="/admin" />
    <div className="container py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">RBAC Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage user roles, monitor support operations, and review role-change audit logs.</p>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Users & roles</h2>
        <div className="grid gap-3">
          {users.map((user) => (
            <Card key={user.userId} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Avatar><AvatarFallback>{user.initials}</AvatarFallback></Avatar>
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{user.userId}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {MANAGED_ROLES.map((role) => {
                  const hasRole = user.roles.includes(role);
                  return (
                    <Button key={role} size="sm" variant={hasRole ? "default" : "outline"} disabled={busy} onClick={() => setRole(user.userId, role, !hasRole)}>
                      {hasRole ? `Revoke ${role}` : `Grant ${role}`}
                    </Button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Host verification</h2>
        {hostProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No host profiles yet.</p>
        ) : (
          <div className="grid gap-3">
            {hostProfiles.map((hp) => {
              const displayName = profiles.find(p => p.user_id === hp.user_id)?.display_name ?? hp.user_id.slice(0, 8);
              return (
                <Card key={hp.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{hp.business_name ?? displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{hp.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(hp.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={hp.verification_status === "verified" ? "default" : hp.verification_status === "rejected" ? "destructive" : "secondary"}>
                      {hp.verification_status}
                    </Badge>
                    {hp.verification_status === "pending" || hp.verification_status === "unverified" ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => verifyHost(hp.id, "verified")}>Verify</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => verifyHost(hp.id, "rejected")}>Reject</Button>
                      </>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent tickets</h2>
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between">
              <div><p className="font-medium">#{t.ticket_num} · {t.subject}</p><p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p></div>
              <div className="flex gap-2">{t.escalated && <Badge variant="destructive">Escalated</Badge>}<Badge variant="secondary">{t.status}</Badge></div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Role audit log</h2>
        <div className="space-y-2">
          {audit.map((r) => (
            <Card key={r.id} className="p-3 text-sm flex justify-between"><span>{r.action} <strong>{r.role}</strong> → <code className="text-xs">{r.target_user_id.slice(0, 8)}</code></span><span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</span></Card>
          ))}
        </div>
      </section>
    </div>
    </div>
  );
}