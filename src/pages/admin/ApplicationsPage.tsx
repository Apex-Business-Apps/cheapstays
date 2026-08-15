// src/pages/admin/ApplicationsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { FileText, MessageSquare, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HostApplicationReviewDialog } from "@/features/admin/HostApplicationReview";
import { TicketApplicationReview } from "@/features/admin/TicketApplicationReview";
import { submitHostApplicationDecision } from "@/features/admin/adminHostApproval.service";
import { bucketBadgeClass, kycBucket, ticketBucket, type ApplicationBucket } from "@/features/admin/applicationBadges";
import { Seo } from "@/components/Seo";
import type { HostApp, SupportTicket, TicketStatus } from "./types";

type Bucket = ApplicationBucket;
type Source = "kyc" | "ticket";

type Application = {
  key: string;
  source: Source;
  createdAt: string;
  title: string;
  subtitle: string;
  bucket: Bucket;
  statusLabel: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  kyc?: HostApp;
  ticket?: SupportTicket;
};

const BUCKET_LABEL: Record<Bucket, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
};

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [hostApps, setHostApps] = useState<HostApp[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantingHost, setGrantingHost] = useState<string | null>(null);
  const [dismissingTicket, setDismissingTicket] = useState<string | null>(null);
  const [reviewApp, setReviewApp] = useState<HostApp | null>(null);
  const [reviewTicket, setReviewTicket] = useState<SupportTicket | null>(null);
  const [tab, setTab] = useState<Bucket>("pending");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [appsRes, ticketRes] = await Promise.all([
      supabase
        .from("host_applications")
        .select(
          "id,user_id,full_legal_name,phone,property_type,city,province,property_description,id_type,id_front_path,selfie_path,status,created_at,reviewed_by,reviewed_at,rejection_reason",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("support_tickets")
        .select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
        .eq("category", "host_verification")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setHostApps((appsRes.data as HostApp[]) ?? []);
    setTickets((ticketRes.data as SupportTicket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applications = useMemo<Application[]>(() => {
    const kycRows: Application[] = hostApps.map((a) => ({
      key: `kyc:${a.id}`,
      source: "kyc",
      createdAt: a.created_at,
      title: a.full_legal_name,
      subtitle: `${a.property_type} · ${a.city}, ${a.province}`,
      bucket: kycBucket(a.status),
      statusLabel: a.status.replace("_", " "),
      reviewedAt: a.reviewed_at ?? null,
      rejectionReason: a.rejection_reason ?? null,
      kyc: a,
    }));
    const ticketRows: Application[] = tickets.map((t) => ({
      key: `ticket:${t.id}`,
      source: "ticket",
      createdAt: t.created_at,
      title: t.subject,
      subtitle: `Support chat · #${t.ticket_num}`,
      bucket: ticketBucket(t.status),
      statusLabel: t.status,
      ticket: t,
    }));
    return [...kycRows, ...ticketRows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [hostApps, tickets]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { pending: 0, approved: 0, rejected: 0, all: applications.length };
    for (const app of applications) c[app.bucket]++;
    return c;
  }, [applications]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((app) => {
      if (tab !== "all" && app.bucket !== tab) return false;
      if (!q) return true;
      const hay = [
        app.title,
        app.subtitle,
        app.ticket?.ticket_num ? `#${app.ticket.ticket_num}` : "",
        app.kyc?.phone ?? "",
        app.kyc?.city ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [applications, tab, query]);

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setDismissingTicket(ticketId);
    try {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) throw error;
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
      if (reviewTicket?.id === ticketId) setReviewTicket(null);
      toast.success("Ticket dismissed.");
    } catch {
      toast.error("Could not update ticket status.");
    } finally {
      setDismissingTicket(null);
    }
  };

  const grantHostRole = async (ticketId: string) => {
    setGrantingHost(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("approve-host-via-ticket", {
        body: { ticket_id: ticketId },
      });
      if (error) {
        let msg = error.message;
        try {
          const body = (await (error as { context?: Response }).context?.json()) as { error?: string } | undefined;
          if (body?.error) msg = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: "resolved" } : t)));
      if (reviewTicket?.id === ticketId) setReviewTicket(null);
      toast.success(
        data?.already_host ? "User already a host — ticket resolved." : "Host approved and ticket resolved.",
      );
    } catch (err) {
      toast.error(`Approval failed: ${(err as Error).message}`);
    } finally {
      setGrantingHost(null);
    }
  };

  const handleAppDecision = async (appId: string, userId: string, approve: boolean, reason?: string) => {
    try {
      await submitHostApplicationDecision({
        applicationId: appId,
        targetUserId: userId,
        reviewerId: user?.id,
        approve,
        reason,
      });
      await load();
      toast.success(approve ? "Application approved and host status confirmed." : "Application rejected.");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <Seo title="Applications · CheapStays Admin" description="Host application review." path="/admin/applications" />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Host onboarding from the KYC form and the support-chat verification queue.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, subject, ticket #…"
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)}>
        <TabsList className="mb-4">
          {(["pending", "approved", "rejected", "all"] as Bucket[]).map((b) => (
            <TabsTrigger key={b} value={b} className="gap-1.5">
              {BUCKET_LABEL[b]}
              <span className="text-[10px] text-muted-foreground">({counts[b]})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(["pending", "approved", "rejected", "all"] as Bucket[]).map((b) => (
          <TabsContent key={b} value={b} className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {query ? "No applications match your search." : "Nothing here."}
              </p>
            ) : (
              filtered.map((app) => (
                <ApplicationRow
                  key={app.key}
                  app={app}
                  onOpen={() => {
                    if (app.source === "kyc" && app.kyc) setReviewApp(app.kyc);
                    if (app.source === "ticket" && app.ticket) setReviewTicket(app.ticket);
                  }}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <HostApplicationReviewDialog
        app={reviewApp}
        open={reviewApp !== null}
        onClose={() => setReviewApp(null)}
        onDecision={handleAppDecision}
      />
      <TicketApplicationReview
        ticket={reviewTicket}
        open={reviewTicket !== null}
        onClose={() => setReviewTicket(null)}
        onApprove={grantHostRole}
        onDismiss={(id) => updateTicketStatus(id, "closed")}
        approving={grantingHost === reviewTicket?.id}
        dismissing={dismissingTicket === reviewTicket?.id}
      />
    </>
  );
}

function ApplicationRow({ app, onOpen }: { app: Application; onOpen: () => void }) {
  const created = parseISO(app.createdAt);
  const kycHasId = app.kyc?.id_front_path;
  const kycHasSelfie = app.kyc?.selfie_path;

  return (
    <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          {app.source === "kyc" ? (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1">
              <FileText className="h-2.5 w-2.5" /> KYC form
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1">
              <MessageSquare className="h-2.5 w-2.5" /> Support chat
            </Badge>
          )}
          <Badge className={`text-[10px] h-4 px-1.5 capitalize ${bucketBadgeClass(app.bucket)}`}>
            {app.statusLabel}
          </Badge>
          {app.source === "kyc" && (
            <>
              <Badge
                variant={kycHasId ? "default" : "destructive"}
                className="text-[10px] h-4 px-1.5"
                title={kycHasId ? "Government ID uploaded" : "Government ID missing"}
              >
                {kycHasId ? "ID ✓" : "No ID"}
              </Badge>
              <Badge
                variant={kycHasSelfie ? "default" : "destructive"}
                className="text-[10px] h-4 px-1.5"
                title={kycHasSelfie ? "Selfie uploaded" : "Selfie missing"}
              >
                {kycHasSelfie ? "Selfie ✓" : "No selfie"}
              </Badge>
            </>
          )}
        </div>
        <p className="font-medium text-sm truncate">{app.title}</p>
        <p className="text-xs text-muted-foreground truncate">{app.subtitle}</p>
        <p
          className="text-xs text-muted-foreground mt-0.5"
          title={format(created, "dd MMM yyyy · HH:mm")}
        >
          {formatDistanceToNow(created, { addSuffix: true })}
          <span className="text-muted-foreground/70"> · {format(created, "dd MMM yyyy")}</span>
        </p>
        {app.rejectionReason && (
          <p className="text-xs text-muted-foreground mt-1 italic">“{app.rejectionReason}”</p>
        )}
      </div>
      <div className="shrink-0">
        <Button size="sm" onClick={onOpen}>
          Review
        </Button>
      </div>
    </Card>
  );
}
