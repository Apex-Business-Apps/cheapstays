import { Fragment, useEffect, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowRight, Building2, Calendar, CreditCard, ExternalLink, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import type { BookingDetail } from "@/pages/admin/types";
import { STATUS_COLORS } from "@/pages/admin/types";

const STATUS_STYLES: Record<string, { border: string; bg: string }> = {
  confirmed: { border: "border-l-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  pending:   { border: "border-l-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30" },
  cancelled: { border: "border-l-red-400",     bg: "bg-red-50 dark:bg-red-950/30" },
  completed: { border: "border-l-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30" },
  no_show:   { border: "border-l-gray-400",    bg: "bg-gray-50 dark:bg-gray-900/30" },
};

interface Props {
  bookingId: string | null;
  onClose: () => void;
}

export function BookingDetailDrawer({ bookingId, onClose }: Props) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) { setDetail(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    (async () => {
      const { data: bk, error: bkErr } = await supabase
        .from("bookings")
        .select(`
          id, listing_id, guest_id, host_id,
          check_in, check_out, nights, guests, status, total_php,
          payment_status, payment_method, payment_ref,
          refundable_until, payout_release_on,
          guest_message, cancellation_reason, cancelled_at,
          confirmed_at, created_at
        `)
        .eq("id", bookingId)
        .single();

      if (bkErr || !bk) {
        if (!cancelled) { setError("Could not load booking."); setLoading(false); }
        return;
      }

      const [
        { data: guestProfile },
        { data: hostProfile },
        { data: listing },
      ] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", bk.guest_id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("user_id", bk.host_id).maybeSingle(),
        supabase.from("listings").select("title, city, province, address, type, nightly_php").eq("id", bk.listing_id).maybeSingle(),
      ]);

      if (cancelled) return;

      setDetail({
        ...bk,
        payment_status: bk.payment_status ?? null,
        payment_method: bk.payment_method ?? null,
        payment_ref: bk.payment_ref ?? null,
        refundable_until: bk.refundable_until ?? null,
        payout_release_on: bk.payout_release_on ?? null,
        guest_message: bk.guest_message ?? null,
        cancellation_reason: bk.cancellation_reason ?? null,
        cancelled_at: bk.cancelled_at ?? null,
        confirmed_at: bk.confirmed_at ?? null,
        guestName: guestProfile?.display_name ?? bk.guest_id.slice(0, 8),
        hostName: hostProfile?.display_name ?? bk.host_id.slice(0, 8),
        listingTitle: listing?.title ?? "Unknown listing",
        listingCity: listing?.city ?? "",
        listingProvince: listing?.province ?? "",
        listingAddress: listing?.address ?? null,
        listingType: listing?.type ?? "",
        nightlyPhp: listing?.nightly_php ?? 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <Sheet open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>Booking Details</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-4">
          {loading && <DrawerSkeleton />}
          {error && !loading && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {detail && !loading && <DrawerContent detail={detail} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

function initials(name: string) {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?"
  );
}

function DrawerContent({ detail }: { detail: BookingDetail }) {
  const fmt = (d: string) => format(parseISO(d), "MMM d, yyyy");
  const fmtMaybe = (d: string | null) => (d ? format(parseISO(d), "MMM d, yyyy") : "—");
  const style = STATUS_STYLES[detail.status] ?? STATUS_STYLES.no_show;

  return (
    <div className="space-y-3">
      {/* Hero strip */}
      <div className={`rounded-xl border-l-4 ${style.border} ${style.bg} p-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{detail.listingTitle}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">#{detail.id.slice(0, 8)}</p>
          </div>
          <Badge className={`shrink-0 text-white text-[10px] capitalize ${STATUS_COLORS[detail.status] ?? "bg-gray-400"}`}>
            {detail.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Booked {fmt(detail.created_at)}</p>
      </div>

      {/* Stay timeline */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stay</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Check-in</p>
            <p className="text-sm font-semibold">{format(parseISO(detail.check_in), "MMM d")}</p>
            <p className="text-[10px] text-muted-foreground">{format(parseISO(detail.check_in), "yyyy")}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <div className="h-px w-6 bg-border" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="h-px w-6 bg-border" />
            </div>
            <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
              {detail.nights}n
            </span>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Check-out</p>
            <p className="text-sm font-semibold">{format(parseISO(detail.check_out), "MMM d")}</p>
            <p className="text-[10px] text-muted-foreground">{format(parseISO(detail.check_out), "yyyy")}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Guests</p>
            <p className="text-sm font-semibold">{detail.guests}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Nightly</p>
            <p className="text-sm font-semibold">₱{detail.nightlyPhp.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-semibold">₱{detail.total_php.toLocaleString()}</p>
          </div>
        </div>
        {detail.confirmed_at && (
          <p className="text-[10px] text-muted-foreground">Confirmed {fmt(detail.confirmed_at)}</p>
        )}
      </div>

      {/* Guest + Host */}
      <div className="grid grid-cols-2 gap-3">
        <PersonCard label="Guest" name={detail.guestName} userId={detail.guest_id} />
        <PersonCard label="Host"  name={detail.hostName}  userId={detail.host_id} />
      </div>

      {/* Payment */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</p>
        <IconRow icon={<CreditCard className="h-3.5 w-3.5" />}  label="Method"           value={detail.payment_method ?? "—"} />
        <IconRow icon={<span className="text-[11px] font-bold text-muted-foreground">₱</span>} label="Status" value={detail.payment_status ?? "—"} />
        <IconRow icon={<Receipt className="h-3.5 w-3.5" />}     label="Reference"         value={detail.payment_ref ?? "—"} />
        <IconRow icon={<Calendar className="h-3.5 w-3.5" />}    label="Refundable until"  value={fmtMaybe(detail.refundable_until)} />
        <IconRow icon={<Calendar className="h-3.5 w-3.5" />}    label="Payout release"    value={fmtMaybe(detail.payout_release_on)} />
      </div>

      {/* Property */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Property</p>
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{detail.listingTitle}</p>
            <p className="text-xs text-muted-foreground capitalize">{detail.listingType.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">
              {[detail.listingCity, detail.listingProvince].filter(Boolean).join(", ")}
            </p>
            {detail.listingAddress && (
              <p className="text-xs text-muted-foreground">{detail.listingAddress}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {(detail.guest_message || detail.cancellation_reason) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          {detail.guest_message && (
            <div className="border-l-2 border-primary/40 pl-3">
              <p className="text-[10px] text-muted-foreground mb-1">Guest message</p>
              <p className="text-xs leading-relaxed">{detail.guest_message}</p>
            </div>
          )}
          {detail.cancellation_reason && (
            <div className="border-l-2 border-destructive/40 pl-3">
              <p className="text-[10px] text-muted-foreground mb-1">Cancellation reason</p>
              <p className="text-xs leading-relaxed">{detail.cancellation_reason}</p>
              {detail.cancelled_at && (
                <p className="text-[10px] text-muted-foreground mt-1">Cancelled {fmt(detail.cancelled_at)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCard({ label, name, userId }: { label: string; name: string; userId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col items-center text-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-start">
        {label}
      </p>
      <Avatar className="h-10 w-10">
        <AvatarFallback className="text-sm font-medium">{initials(name)}</AvatarFallback>
      </Avatar>
      <p className="text-xs font-medium leading-tight line-clamp-2">{name}</p>
      <Link
        to={`/admin/users?highlight=${userId}`}
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline min-h-[44px]"
      >
        View in Users <ExternalLink className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}

function IconRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium ml-auto text-right break-all">{value}</span>
    </div>
  );
}
