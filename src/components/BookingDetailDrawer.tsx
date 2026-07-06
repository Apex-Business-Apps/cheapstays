import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { BookingDetail } from "@/pages/admin/types";
import { STATUS_COLORS } from "@/pages/admin/types";

interface Props {
  bookingId: string | null;
  onClose: () => void;
}

export function BookingDetailDrawer({ bookingId, onClose }: Props) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) { setDetail(null); return; }
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Booking Details</SheetTitle>
        </SheetHeader>

        {loading && <DrawerSkeleton />}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {detail && !loading && <DrawerContent detail={detail} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-6">
      {[80, 120, 100, 80, 60].map((h, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className={`h-${h === 60 ? 4 : h === 80 ? 4 : 5} w-full`} />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function DrawerContent({ detail }: { detail: BookingDetail }) {
  const fmt = (d: string) => format(parseISO(d), "MMM d, yyyy");
  const fmtMaybe = (d: string | null) => d ? format(parseISO(d), "MMM d, yyyy") : "—";

  return (
    <div className="space-y-6 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">
            #{detail.id.slice(0, 8)}
          </p>
          <p className="text-xs text-muted-foreground">Booked {fmt(detail.created_at)}</p>
        </div>
        <Badge
          className={`shrink-0 text-white text-[10px] ${STATUS_COLORS[detail.status] ?? "bg-gray-400"}`}
        >
          {detail.status}
        </Badge>
      </div>

      <Divider label="Stay" />
      <InfoGrid rows={[
        ["Check-in",  fmt(detail.check_in)],
        ["Check-out", fmt(detail.check_out)],
        ["Nights",    String(detail.nights)],
        ["Guests",    String(detail.guests)],
        ["Total",     `₱${detail.total_php.toLocaleString()}`],
        ["Nightly rate", `₱${detail.nightlyPhp.toLocaleString()}`],
        ...(detail.confirmed_at ? [["Confirmed", fmt(detail.confirmed_at)] as [string,string]] : []),
      ]} />

      <Divider label="Payment" />
      <InfoGrid rows={[
        ["Status",    detail.payment_status ?? "—"],
        ["Method",    detail.payment_method ?? "—"],
        ["Reference", detail.payment_ref ?? "—"],
        ["Refundable until",   fmtMaybe(detail.refundable_until)],
        ["Payout release",     fmtMaybe(detail.payout_release_on)],
      ]} />

      <Divider label="Guest" />
      <InfoGrid rows={[
        ["Name", detail.guestName],
        ["ID",   detail.guest_id.slice(0, 8) + "…"],
      ]} />
      <Link
        to={`/admin/users?highlight=${detail.guest_id}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        View in Users <ExternalLink className="h-3 w-3" />
      </Link>

      <Divider label="Host" />
      <InfoGrid rows={[
        ["Name", detail.hostName],
        ["ID",   detail.host_id.slice(0, 8) + "…"],
      ]} />
      <Link
        to={`/admin/users?highlight=${detail.host_id}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        View in Users <ExternalLink className="h-3 w-3" />
      </Link>

      <Divider label="Property" />
      <InfoGrid rows={[
        ["Listing",   detail.listingTitle],
        ["Type",      detail.listingType],
        ["Location",  [detail.listingCity, detail.listingProvince].filter(Boolean).join(", ")],
        ...(detail.listingAddress ? [["Address", detail.listingAddress] as [string,string]] : []),
      ]} />

      {(detail.guest_message || detail.cancellation_reason) && (
        <>
          <Divider label="Notes" />
          {detail.guest_message && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Guest message</p>
              <p className="text-sm leading-relaxed">{detail.guest_message}</p>
            </div>
          )}
          {detail.cancellation_reason && (
            <div className="space-y-1 mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cancellation reason</p>
              <p className="text-sm leading-relaxed">{detail.cancellation_reason}</p>
              {detail.cancelled_at && (
                <p className="text-xs text-muted-foreground">Cancelled {fmt(detail.cancelled_at)}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{label}</p>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([label, value]) => (
        <>
          <dt key={`${label}-dt`} className="text-muted-foreground text-xs">{label}</dt>
          <dd key={`${label}-dd`} className="text-xs font-medium break-all">{value}</dd>
        </>
      ))}
    </dl>
  );
}
