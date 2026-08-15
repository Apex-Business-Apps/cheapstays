import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { bucketBadgeClass, ticketBucket } from "@/features/admin/applicationBadges";
import { SENDER_LABEL, type SupportTicket, type TicketMessage } from "@/pages/admin/types";

type KycSummary = {
  id: string;
  status: string;
  full_legal_name: string;
  phone: string | null;
  city: string | null;
  province: string | null;
  id_type: string | null;
  id_front_path: string | null;
  selfie_path: string | null;
};

type Contact = {
  email: string | null;
  display_name: string | null;
  account_created_at: string | null;
};

type Props = {
  ticket: SupportTicket | null;
  open: boolean;
  onClose: () => void;
  onApprove: (ticketId: string) => Promise<void>;
  onDismiss: (ticketId: string) => Promise<void>;
  approving: boolean;
  dismissing: boolean;
  onOpenKycReview?: (kycAppId: string) => void;
};

export function TicketApplicationReview({
  ticket,
  open,
  onClose,
  onApprove,
  onDismiss,
  approving,
  dismissing,
  onOpenKycReview,
}: Props) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [kyc, setKyc] = useState<KycSummary | null>(null);
  const [loadingApplicant, setLoadingApplicant] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);

  const ticketId = ticket?.id ?? null;
  const userId = ticket?.user_id ?? null;

  const loadApplicant = useCallback(async () => {
    if (!userId) return;
    setLoadingApplicant(true);
    const [contactRes, kycRes] = await Promise.all([
      supabase.rpc("admin_get_user_contact", { target: userId }),
      supabase
        .from("host_applications")
        .select("id,status,full_legal_name,phone,city,province,id_type,id_front_path,selfie_path")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const row = Array.isArray(contactRes.data) ? contactRes.data[0] : null;
    setContact(row ? { email: row.email, display_name: row.display_name, account_created_at: row.account_created_at } : null);
    setKyc((kycRes.data as KycSummary | null) ?? null);
    setLoadingApplicant(false);
  }, [userId]);

  const loadMessages = useCallback(async () => {
    if (!ticketId) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from("support_messages")
      .select("id,sender,content,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages((data as TicketMessage[]) ?? []);
    setLoadingMessages(false);
  }, [ticketId]);

  useEffect(() => {
    if (!open || !ticketId) return;
    setConfirmingApprove(false);
    setContact(null);
    setKyc(null);
    void loadApplicant();
    void loadMessages();
  }, [open, ticketId, loadApplicant, loadMessages]);

  const requirements = useMemo(() => {
    const hasKyc = !!kyc;
    return [
      { label: "Legal name on file", ok: !!kyc?.full_legal_name },
      { label: "Phone number captured", ok: !!kyc?.phone },
      { label: "Government ID uploaded", ok: !!kyc?.id_front_path },
      { label: "Selfie with ID uploaded", ok: !!kyc?.selfie_path },
      { label: "KYC form submitted", ok: hasKyc },
    ];
  }, [kyc]);

  const applicantName = contact?.display_name?.trim() || kyc?.full_legal_name || "Unknown applicant";
  const applicantPhone = kyc?.phone || null;
  const applicantEmail = contact?.email || null;
  const accountCreated = contact?.account_created_at ? parseISO(contact.account_created_at) : null;

  if (!ticket) return null;

  const busy = approving || dismissing;
  const bucket = ticketBucket(ticket.status);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{ticket.ticket_num}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">Host verification</Badge>
            <Badge className={`text-[10px] h-4 px-1.5 capitalize ${bucketBadgeClass(bucket)}`}>
              {ticket.status}
            </Badge>
          </div>
          <SheetTitle className="text-base leading-snug">{ticket.subject}</SheetTitle>
          <SheetDescription className="text-xs">
            Opened {formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: true })}
            <span className="text-muted-foreground/70"> · {format(parseISO(ticket.created_at), "dd MMM yyyy · HH:mm")}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicant</h3>
            {loadingApplicant ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <dl className="min-w-0 flex-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground text-xs flex items-center gap-1"><UserCircle2 className="h-3 w-3" /> Name</dt>
                    <dd className="font-medium truncate">{applicantName}</dd>

                    <dt className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</dt>
                    <dd className="truncate">{applicantPhone ?? <span className="text-muted-foreground italic">Not provided</span>}</dd>

                    <dt className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</dt>
                    <dd className="truncate">
                      {applicantEmail ? (
                        <a href={`mailto:${applicantEmail}`} className="text-primary hover:underline">{applicantEmail}</a>
                      ) : (
                        <span className="text-muted-foreground italic">Not available</span>
                      )}
                    </dd>

                    <dt className="text-muted-foreground text-xs">Account</dt>
                    <dd className="truncate text-xs text-muted-foreground">
                      {accountCreated ? (
                        <>Created {formatDistanceToNow(accountCreated, { addSuffix: true })}</>
                      ) : (
                        <span className="italic">Unknown</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirements</h3>
            {loadingApplicant ? (
              <div className="rounded-lg border p-3 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-3.5 w-full" />)}
              </div>
            ) : (
              <ul className="space-y-1.5 rounded-lg border p-3">
                {requirements.map((req) => (
                  <li key={req.label} className="flex items-center gap-2 text-xs">
                    {req.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    )}
                    <span className={req.ok ? "" : "text-muted-foreground"}>{req.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!loadingApplicant && (
            <section>
              {kyc ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-sm font-medium">KYC form also submitted</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="capitalize">{kyc.status}</span>
                    {kyc.id_type && <> · ID type: {kyc.id_type}</>}
                  </p>
                  {onOpenKycReview && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenKycReview(kyc.id)}>
                      Open KYC review
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-foreground mb-0.5">No KYC form on file</p>
                    <p className="text-muted-foreground">
                      Approving from this ticket alone grants the host role without government-ID verification.
                      Consider asking the applicant to complete <span className="font-mono">/host/apply</span> first.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conversation {messages.length > 0 && <span className="text-muted-foreground/70">· {messages.length}</span>}
            </h3>
            {loadingMessages ? (
              <p className="text-xs text-muted-foreground">Loading thread…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="scrollbar-visible space-y-2 max-h-72 overflow-y-auto pr-2 rounded-lg border bg-background/40 p-2">
                {messages.map((msg) => (
                  <div key={msg.id} className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {SENDER_LABEL[msg.sender] ?? msg.sender}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(msg.created_at), "dd MMM · HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-4">
          {confirmingApprove ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="font-medium text-foreground">Grant host role to {applicantName}?</p>
                <p className="text-muted-foreground mt-1">
                  This is permanent until a separate revoke action. It will resolve ticket #{ticket.ticket_num}
                  and send an approval notification.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setConfirmingApprove(false)} disabled={approving}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => { await onApprove(ticket.id); setConfirmingApprove(false); }}
                  disabled={approving}
                >
                  {approving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Confirm approval
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => onDismiss(ticket.id)}
                disabled={busy}
              >
                {dismissing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Dismiss ticket
              </Button>
              <Button size="sm" onClick={() => setConfirmingApprove(true)} disabled={busy}>
                Approve as host
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
