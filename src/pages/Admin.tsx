import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AuditRow = { id: string; target_user_id: string; role: string; action: string; created_at: string };
type Ticket = { id: string; ticket_num: number; subject: string; status: string; escalated: boolean; created_at: string };

export default function Admin() {
  const { roles, loading } = useAuth();
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    supabase.from("role_audit_log").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setAudit((data as AuditRow[]) ?? []));
    supabase.from("support_tickets").select("id,ticket_num,subject,status,escalated,created_at").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setTickets((data as Ticket[]) ?? []));
  }, [roles]);

  if (loading) return <div className="container py-20">Loading…</div>;
  if (!roles.includes("admin")) {
    return (
      <div className="container py-20 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Admin only</h1>
        <p className="text-muted-foreground mt-2">You don't have admin access.</p>
      </div>
    );
  }

  return (
    <div className="container py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-2">Role grants and recent support activity.</p>
      </div>
      <section>
        <h2 className="text-lg font-medium mb-3">Recent tickets</h2>
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">#{t.ticket_num} · {t.subject}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                {t.escalated && <Badge variant="destructive">Escalated</Badge>}
                <Badge variant="secondary">{t.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-medium mb-3">Role audit log</h2>
        <div className="space-y-2">
          {audit.map((r) => (
            <Card key={r.id} className="p-3 text-sm flex justify-between">
              <span>{r.action} <strong>{r.role}</strong> → <code className="text-xs">{r.target_user_id.slice(0, 8)}</code></span>
              <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
