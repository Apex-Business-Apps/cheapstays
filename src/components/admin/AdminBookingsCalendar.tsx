import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listingColor } from "@/lib/listing-color";
import { STATUS_COLORS } from "@/pages/admin/types";
import {
  AdminBookingsMonthGrid,
  AdminBookingsWeekRow,
  type CalendarBooking,
} from "./AdminBookingsMonthGrid";
type Booking = CalendarBooking;

type ViewMode = "day" | "week" | "month";

type Props = {
  bookings: Booking[];
  onSelectBooking: (id: string) => void;
};

function bookingsOnDay(bookings: Booking[], day: Date): Booking[] {
  return bookings.filter((b) => {
    const ci = parseISO(b.check_in);
    const co = parseISO(b.check_out);
    return day >= ci && day < co;
  });
}

export function AdminBookingsCalendar({ bookings, onSelectBooking }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [listingFilter, setListingFilter] = useState<string>("all");

  const listingOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) {
      if (!map.has(b.listing_id)) map.set(b.listing_id, b.listings?.title ?? "Untitled");
    }
    return Array.from(map, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [bookings]);

  const filteredBookings = useMemo(
    () =>
      listingFilter === "all"
        ? bookings
        : bookings.filter((b) => b.listing_id === listingFilter),
    [bookings, listingFilter],
  );

  const headerLabel =
    viewMode === "month"
      ? format(month, "MMMM yyyy")
      : viewMode === "week"
        ? `${format(startOfWeek(anchorDate, { weekStartsOn: 0 }), "MMM d")} – ${format(
            endOfWeek(anchorDate, { weekStartsOn: 0 }),
            "MMM d, yyyy",
          )}`
        : format(anchorDate, "EEEE, MMM d, yyyy");

  const goPrev = () => {
    if (viewMode === "month") setMonth((m) => subMonths(m, 1));
    else if (viewMode === "week") setAnchorDate((d) => subDays(d, 7));
    else setAnchorDate((d) => subDays(d, 1));
  };
  const goNext = () => {
    if (viewMode === "month") setMonth((m) => addMonths(m, 1));
    else if (viewMode === "week") setAnchorDate((d) => addDays(d, 7));
    else setAnchorDate((d) => addDays(d, 1));
  };
  const goToday = () => {
    const now = new Date();
    setMonth(startOfMonth(now));
    setAnchorDate(now);
  };

  const openDayBookings = openDay ? bookingsOnDay(filteredBookings, openDay) : [];

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{headerLabel}</h3>
          <p className="text-[11px] text-muted-foreground">
            Bars are colored by listing. Click a bar to open booking details.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={listingFilter} onValueChange={setListingFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Listing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All listings</SelectItem>
              {listingOptions.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="px-3 text-xs">Day</TabsTrigger>
              <TabsTrigger value="week" className="px-3 text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="px-3 text-xs">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={goToday}>Today</Button>
            <Button size="icon" variant="ghost" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="inline-flex items-center gap-1.5 capitalize">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            {status.replace("_", " ")}
          </span>
        ))}
      </div>

      {viewMode === "month" && (
        <AdminBookingsMonthGrid
          month={month}
          bookings={filteredBookings}
          onSelectBooking={onSelectBooking}
          onOpenDay={(d) => setOpenDay(d)}
        />
      )}

      {viewMode === "week" && (
        <WeekStrip
          anchorDate={anchorDate}
          bookings={filteredBookings}
          onSelectBooking={onSelectBooking}
          onOpenDay={(d) => setOpenDay(d)}
        />
      )}

      {viewMode === "day" && (
        <DayList
          day={anchorDate}
          bookings={bookingsOnDay(filteredBookings, anchorDate)}
          onSelectBooking={onSelectBooking}
        />
      )}

      <Dialog open={openDay !== null} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openDay ? format(openDay, "EEEE, MMM d, yyyy") : ""}</DialogTitle>
            <DialogDescription>
              {openDayBookings.length === 0
                ? "No bookings on this day."
                : `${openDayBookings.length} booking${openDayBookings.length > 1 ? "s" : ""} on this day.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {openDayBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onClick={() => {
                  setOpenDay(null);
                  onSelectBooking(b.id);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BookingRow({ booking, onClick }: { booking: Booking; onClick: () => void }) {
  const color = listingColor(booking.listing_id);
  const title = booking.listings?.title ?? "Listing";
  const guest = booking.guest_name_snapshot?.trim();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 rounded-md border border-border/60 p-3 text-left hover:bg-secondary/40 transition-colors min-h-[44px]"
    >
      <span className={cn("h-8 w-1 rounded-sm shrink-0 mt-0.5", color.bar)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{title}</span>
          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
            {booking.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
          {guest ? ` · ${guest}` : ""}
          {" · "}₱{booking.total_php.toLocaleString()}
        </p>
      </div>
    </button>
  );
}

function DayList({
  day,
  bookings,
  onSelectBooking,
}: {
  day: Date;
  bookings: Booking[];
  onSelectBooking: (id: string) => void;
}) {
  const isToday = isSameDay(day, new Date());
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", isToday ? "bg-primary" : "bg-muted-foreground/40")} />
        <span>{isToday ? "Today" : format(day, "EEEE")}</span>
        <span className="text-foreground font-medium">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </span>
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No bookings on this day.
        </p>
      ) : (
        <div className="space-y-1.5">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} onClick={() => onSelectBooking(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekStrip({
  anchorDate,
  bookings,
  onSelectBooking,
  onOpenDay,
}: {
  anchorDate: Date;
  bookings: Booking[];
  onSelectBooking: (id: string) => void;
  onOpenDay: (day: Date) => void;
}) {
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
  return (
    <AdminBookingsWeekRow
      weekStart={weekStart}
      bookings={bookings}
      today={new Date()}
      showDayName
      onSelectBooking={onSelectBooking}
      onOpenDay={onOpenDay}
    />
  );
}
