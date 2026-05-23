import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Loader2 } from "lucide-react";

export type HostApp = {
  id: string; user_id: string; full_legal_name: string; phone: string;
  property_type: string; city: string; province: string; property_description: string;
  id_type: string; id_front_path: string | null; selfie_path: string | null;
  status: string; created_at: string;
};

function AppReviewDialog({ app, open, onClose, onDecision }: {
  app: HostApp | null;
  open: boolean;
  onClose: () => void;
  onDecision: (appId: string, userId: string, approve: boolean, reason?: string) => Promise<void>;
}) {
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!app) return;
    setIdUrl(null);
    setSelfieUrl(null);
    const current = app;
    async function fetchUrls() {
      if (current.id_front_path) {
        const { data } = await supabase.storage.from("host-verification").createSignedUrl(current.id_front_path, 300);
        setIdUrl(data?.signedUrl ?? null);
      }
      if (current.selfie_path) {
        const { data } = await supabase.storage.from("host-verification").createSignedUrl(current.selfie_path, 300);
        setSelfieUrl(data?.signedUrl ?? null);
      }
    }
    void fetchUrls();
  }, [app]);

  if (!app) return null;

  async function decide(approve: boolean) {
    if (!app) return;
    setBusy(true);
    const current = app;
    await onDecision(current.id, current.user_id, approve, approve ? undefined : rejectReason);
    setBusy(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Host Application — {app.full_legal_name}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div><span className="text-muted-foreground">Phone: </span><strong>{app.phone}</strong></div>
            <div><span className="text-muted-foreground">Property: </span><strong>{app.property_type} · {app.city}, {app.province}</strong></div>
            <div><span className="text-muted-foreground">ID type: </span><strong>{app.id_type}</strong></div>
            <div><span className="text-muted-foreground">Applied: </span><strong>{format(parseISO(app.created_at), "dd MMM yyyy")}</strong></div>
          </div>
          <div><p className="text-muted-foreground text-xs mb-1">Property description</p><p className="bg-secondary/50 rounded-lg p-3">{app.property_description}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Government ID</p>
              {idUrl ? <a href={idUrl} target="_blank" rel="noopener noreferrer"><img src={idUrl} alt="Government ID" className="rounded-lg border w-full object-cover max-h-48" /><p className="text-xs text-primary mt-1 flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open full size</p></a> : <div className="rounded-lg border bg-secondary/50 flex items-center justify-center h-32 text-xs text-muted-foreground">{app.id_front_path ? "Loading…" : "Not uploaded"}</div>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Selfie with ID</p>
              {selfieUrl ? <a href={selfieUrl} target="_blank" rel="noopener noreferrer"><img src={selfieUrl} alt="Selfie with ID" className="rounded-lg border w-full object-cover max-h-48" /><p className="text-xs text-primary mt-1 flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open full size</p></a> : <div className="rounded-lg border bg-secondary/50 flex items-center justify-center h-32 text-xs text-muted-foreground">{app.selfie_path ? "Loading…" : "Not uploaded"}</div>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-xs text-muted-foreground">Rejection reason (required to reject)</Label>
            <Textarea id="reject-reason" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. ID not legible, selfie does not match ID…" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={() => decide(false)} disabled={busy || !rejectReason.trim()}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reject</Button>
            <Button onClick={() => decide(true)} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Approve host application</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HostApplicationReview({ hostApps, onDecision }: { hostApps: HostApp[]; onDecision: (appId: string, userId: string, approve: boolean, reason?: string) => Promise<void>; }) {
  const [reviewApp, setReviewApp] = useState<HostApp | null>(null);
  const pendingApps = useMemo(() => hostApps.filter((a) => a.status === "pending" || a.status === "manual_review"), [hostApps]);
  const resolvedApps = useMemo(() => hostApps.filter((a) => a.status !== "pending" && a.status !== "manual_review"), [hostApps]);

  return (
    <>
      <div>
        <h2 className="text-base font-semibold mb-3">Pending review{pendingApps.length === 0 && <span className="text-muted-foreground font-normal ml-2">— all clear</span>}</h2>
        <div className="space-y-3">
          {pendingApps.map((app) => (
            <Card key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium">{app.full_legal_name}</p>
                <p className="text-sm text-muted-foreground">{app.property_type} · {app.city}, {app.province}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{app.id_type} · Applied {format(parseISO(app.created_at), "dd MMM yyyy")}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary">{app.status}</Badge>
                <Badge variant={app.id_front_path ? "default" : "destructive"} className="text-[10px]">{app.id_front_path ? "ID ✓" : "No ID"}</Badge>
                <Badge variant={app.selfie_path ? "default" : "destructive"} className="text-[10px]">{app.selfie_path ? "Selfie ✓" : "No selfie"}</Badge>
                <Button size="sm" onClick={() => setReviewApp(app)}>Review</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
      {resolvedApps.length > 0 && <div><h2 className="text-base font-semibold mb-3 text-muted-foreground">Reviewed</h2><div className="space-y-2">{resolvedApps.slice(0, 20).map((app) => <Card key={app.id} className="p-3 flex items-center justify-between"><div><p className="text-sm font-medium">{app.full_legal_name}</p><p className="text-xs text-muted-foreground">{app.city} · {format(parseISO(app.created_at), "dd MMM yyyy")}</p></div><Badge variant={app.status === "approved" ? "default" : "destructive"}>{app.status}</Badge></Card>)}</div></div>}
      <AppReviewDialog app={reviewApp} open={reviewApp !== null} onClose={() => setReviewApp(null)} onDecision={onDecision} />
    </>
  );
}
