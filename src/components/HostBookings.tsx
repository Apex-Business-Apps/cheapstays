import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, Loader2, MailQuestion, Search, Star, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import type { FunctionsHttpError } from "@supabase/supabase-js";

type BookingRow = {
  id: string;
  listing_id: string;
  guest_id: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_php: number;
  status: string;
  booking_flow: string;
  flow_state: string;
  payment_status: string | null;
  stay_type: string | null;
  guest_name_snapshot: string | null;
  created_at: string;
  listing_title: string;
  guest_name: string;
  has_review_request: boolean;
  review_last_sent_at: string | null;
  review_submitted: boolean;
};

type StatusFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";
type SortColumn = "created_at" | "check_in" | "total_php";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 25;
const CHECKOUT_GATE_MS = 24 * 60 * 60 * 1000; // 1 day after checkout
const RESEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  completed: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20",
  refunded: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20",
  no_show: "bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/20",
};

async function unwrapError(err: unknown): Promise<string> {
  const base = (err as Error).message;
  try {
    const body = await (err as FunctionsHttpError).context?.json();
    if (body?.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
  } catch { /* ignore */ }
  return base;
}

export function HostBookings({ hostId }: { hostId: string }) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [devReviewUrl, setDevReviewUrl] = useState<string | null>(null);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let q = sb
          .from("bookings")
          .select(
            "id,listing_id,guest_id,check_in,check_out,nights,guests,total_php,status,booking_flow,flow_state,payment_status,stay_type,guest_name_snapshot,created_at,listings(title)",
            { count: "exact" },
          )
          .eq("host_id", hostId);

        if (statusFilter !== "all") q = q.eq("status", statusFilter);
        q = q.order(sortColumn, { ascending: sortDirection === "asc" });

        // Fetch first, then filter by joined text client-side within the page.
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        q = q.range(from, to);

        const { data: bData, count, error: bErr } = await q;
        if (bErr) throw bErr;
        if (cancelled) return;
        const bookings = (bData ?? []) as Array<Record<string, unknown> & { listings: { title: string } | { title: string }[] | null }>;

        // Enrich with guest display names + existing review requests.
        const guestIds = Array.from(new Set(bookings.map((b) => b.guest_id).filter(Boolean))) as string[];
        const bookingIds = bookings.map((b) => b.id as string);

        const [profilesRes, requestsRes] = await Promise.all([
          guestIds.length === 0
            ? Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] })
            : supabase.from("profiles").select("user_id,display_name").in("user_id", guestIds),
          bookingIds.length === 0
            ? Promise.resolve({ data: [] as { booking_id: string; last_sent_at: string; submitted_review_id: string | null }[] })
            : sb
                .from("review_requests")
                .select("booking_id,last_sent_at,submitted_review_id")
                .in("booking_id", bookingIds),
        ]);

        if (cancelled) return;
        const profileMap = new Map<string, string | null>();
        for (const p of (profilesRes.data ?? []) as { user_id: string; display_name: string | null }[]) {
          profileMap.set(p.user_id, p.display_name);
        }
        const requestMap = new Map<string, { last_sent_at: string; submitted: boolean }>();
        for (const r of (requestsRes.data ?? []) as { booking_id: string; last_sent_at: string; submitted_review_id: string | null }[]) {
          requestMap.set(r.booking_id, { last_sent_at: r.last_sent_at, submitted: !!r.submitted_review_id });
        }

        const enriched: BookingRow[] = bookings.map((b) => {
          const listingRaw = b.listings;
          const listing = Array.isArray(listingRaw) ? listingRaw[0] ?? null : listingRaw;
          const guestId = b.guest_id as string | null;
          const nameFromProfile = guestId ? profileMap.get(guestId) : null;
          const guestName = (nameFromProfile
            ?? (b.guest_name_snapshot as string | null)
            ?? (guestId ? guestId.slice(0, 8) : "Voucher guest")) as string;
          const reqInfo = requestMap.get(b.id as string);
          return {
            id: b.id as string,
            listing_id: b.listing_id as string,
            guest_id: guestId,
            check_in: b.check_in as string,
            check_out: b.check_out as string,
            nights: (b.nights as number) ?? 0,
            guests: (b.guests as number) ?? 0,
            total_php: (b.total_php as number) ?? 0,
            status: (b.status as string) ?? "pending",
            booking_flow: (b.booking_flow as string) ?? "instant_book",
            flow_state: (b.flow_state as string) ?? "",
            payment_status: (b.payment_status as string | null) ?? null,
            stay_type: (b.stay_type as string | null) ?? null,
            guest_name_snapshot: (b.guest_name_snapshot as string | null) ?? null,
            created_at: b.created_at as string,
            listing_title: listing?.title ?? "Untitled listing",
            guest_name: guestName,
            has_review_request: !!reqInfo,
            review_last_sent_at: reqInfo?.last_sent_at ?? null,
            review_submitted: reqInfo?.submitted ?? false,
          };
        });

        setRows(enriched);
        setTotal(count ?? enriched.length);
      } catch (err) {
        if (cancelled) return;
        setError(await unwrapError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [hostId, statusFilter, sortColumn, sortDirection, page, reloadKey]);

  // Client-side search filter across the current page's rows.
  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => r.listing_title.toLowerCase().includes(q) || r.guest_name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function onSort(col: SortColumn) {
    if (sortColumn === col) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(col); setSortDirection("desc"); }
  }

  async function updateStatus(bookingId: string, newStatus: "confirmed" | "cancelled") {
    setBusyId(bookingId);
    try {
      const fn = newStatus === "confirmed" ? "approve-long-term-request" : "cancel-booking-host";
      const body = newStatus === "confirmed"
        ? { booking_id: bookingId }
        : { booking_id: bookingId, reason: "Host declined this booking" };
      const { error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      toast({ title: newStatus === "confirmed" ? "Booking confirmed" : "Booking declined" });
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast({ title: "Update failed", description: await unwrapError(err), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function sendReview(bookingId: string) {
    setBusyId(bookingId);
    try {
      const { data, error } = await supabase.functions.invoke<{
        resent: boolean; email_sent: boolean; review_url: string;
      }>("send-guest-review-request", { body: { booking_id: bookingId } });
      if (error) throw error;
      toast({
        title: data?.resent ? "Review email resent" : "Review email sent",
        description: data?.email_sent
          ? "Guest will get an email with a rating link."
          : "Saved, but email service isn't configured (RESEND_API_KEY missing).",
      });
      // In dev, always show the link so you can test the guest flow yourself.
      // Rewrite host to current origin so the link works even when SITE_URL
      // points to production.
      if (import.meta.env.DEV && data?.review_url) {
        try {
          const parsed = new URL(data.review_url);
          setDevReviewUrl(`${window.location.origin}${parsed.pathname}`);
        } catch {
          setDevReviewUrl(data.review_url);
        }
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast({ title: "Couldn't send review request", description: await unwrapError(err), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-1">
            <div className="relative md:max-w-xs md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search listing or guest"
                className="h-9 pl-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
              <SelectTrigger className="h-9 w-full md:w-44 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${total} ${total === 1 ? "booking" : "bookings"}`}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Listing</TableHead>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Guest</TableHead>
                <SortableHead label="Dates" column="check_in" active={sortColumn} direction={sortDirection} onSort={onSort} />
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground text-right">Nights</TableHead>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground text-right">Guests</TableHead>
                <SortableHead label="Total" column="total_php" active={sortColumn} direction={sortDirection} onSort={onSort} className="text-right" />
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                  ))}
                </TableRow>
              ))}

              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-sm text-red-600 dark:text-red-400">
                    Couldn't load bookings: {error}
                  </TableCell>
                </TableRow>
              )}

              {!loading && !error && visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No bookings match these filters.
                  </TableCell>
                </TableRow>
              )}

              {!loading && !error && visibleRows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedBookingId(r.id)}
                >
                  <TableCell className="max-w-[220px]">
                    <p className="text-sm font-medium truncate">{r.listing_title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">#{r.id.slice(0, 8)}</p>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <p className="text-sm truncate">{r.guest_name}</p>
                    {r.stay_type === "voucher" && (
                      <p className="text-[10px] text-muted-foreground">Voucher</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(parseISO(r.check_in), "MMM d")} → {format(parseISO(r.check_out), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{r.nights}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{r.guests}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right font-medium">
                    ₱{r.total_php.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground border border-border",
                    )}>{r.status}</span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      row={r}
                      busy={busyId === r.id}
                      onView={() => setSelectedBookingId(r.id)}
                      onConfirm={() => updateStatus(r.id, "confirmed")}
                      onDecline={() => updateStatus(r.id, "cancelled")}
                      onSendReview={() => sendReview(r.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <BookingDetailDrawer
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />

        <Dialog open={devReviewUrl !== null} onOpenChange={(o) => !o && setDevReviewUrl(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Dev preview — review link</DialogTitle>
              <DialogDescription>
                Only shown in development. Copy this link or open it in a new tab to test the guest review flow yourself.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/50 p-3 font-mono text-[11px] break-all">
              {devReviewUrl}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (!devReviewUrl) return;
                  navigator.clipboard.writeText(devReviewUrl);
                  toast({ title: "Copied to clipboard" });
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy link
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (devReviewUrl) window.open(devReviewUrl, "_blank", "noopener");
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function SortableHead({
  label, column, active, direction, onSort, className,
}: {
  label: string;
  column: SortColumn;
  active: SortColumn;
  direction: SortDirection;
  onSort: (c: SortColumn) => void;
  className?: string;
}) {
  const isActive = active === column;
  const Icon = !isActive ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium tracking-wide transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}

function RowActions({
  row, busy, onView, onConfirm, onDecline, onSendReview,
}: {
  row: BookingRow;
  busy: boolean;
  onView: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onSendReview: () => void;
}) {
  const isPendingRequest =
    row.status === "pending" && row.booking_flow === "request_booking" && row.flow_state === "requested";

  const gate = getReviewGate(row);

  return (
    <div className="inline-flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onView} aria-label="View booking">
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View booking</TooltipContent>
      </Tooltip>

      {isPendingRequest && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                disabled={busy}
                onClick={onConfirm}
                aria-label="Confirm"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Confirm booking</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={onDecline}
                aria-label="Decline"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Decline booking</TooltipContent>
          </Tooltip>
        </>
      )}

      {!isPendingRequest && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={busy || !gate.enabled}
                onClick={onSendReview}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                {gate.label}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {gate.reason ?? "Email a review link to the guest"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function getReviewGate(row: BookingRow): { enabled: boolean; label: string; reason?: string } {
  if (row.status === "cancelled") return { enabled: false, label: "Send review", reason: "Cancelled bookings can't be reviewed" };
  if (row.review_submitted) return { enabled: false, label: "Reviewed", reason: "Guest already submitted a review" };

  const checkoutMs = new Date(row.check_out).getTime();
  const unlockMs = checkoutMs + CHECKOUT_GATE_MS;
  if (Date.now() < unlockMs) {
    const days = Math.ceil((unlockMs - Date.now()) / (24 * 60 * 60 * 1000));
    return { enabled: false, label: "Send review", reason: `Unlocks ${days} day${days === 1 ? "" : "s"} after check-out` };
  }

  if (row.has_review_request && row.review_last_sent_at) {
    const lastMs = new Date(row.review_last_sent_at).getTime();
    const nextMs = lastMs + RESEND_COOLDOWN_MS;
    if (Date.now() < nextMs) {
      const days = Math.ceil((nextMs - Date.now()) / (24 * 60 * 60 * 1000));
      return { enabled: false, label: "Resend", reason: `Can resend in ${days} day${days === 1 ? "" : "s"}` };
    }
    return { enabled: true, label: "Resend", reason: "Send another reminder email" };
  }

  return { enabled: true, label: "Send review" };
}

export default HostBookings;
