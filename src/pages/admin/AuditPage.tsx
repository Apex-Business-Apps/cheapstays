// src/pages/admin/AuditPage.tsx
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { AuditRow } from "./types";

export default function AuditPage() {
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("role_mutation_audit")
      .select("id,command_id,command_source,operation,target_user_id,reason_code,before_state,after_state,executed_by,created_at")
      .order("created_at", { ascending: false }).limit(100);
    setAuditLog((data as unknown as AuditRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Seo title="Audit Log · CheapStays Admin" description="Role mutation audit log." path="/admin/audit" />
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Audit Log</h1>
      <p className="text-sm text-muted-foreground mb-6">Immutable record of all privileged role mutations.</p>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-2">
          {auditLog.length === 0 && <p className="text-sm text-muted-foreground">No audit records yet.</p>}
          {auditLog.map((r) => (
            <Card key={r.id} className="p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium capitalize">{r.operation.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-muted-foreground">Target: <span className="font-mono">{r.target_user_id.slice(0, 12)}…</span></p>
              <p className="text-muted-foreground">Reason: {r.reason_code}</p>
              <p className="text-muted-foreground">Source: {r.command_source}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
