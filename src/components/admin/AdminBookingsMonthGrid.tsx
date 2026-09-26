import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { listingColor } from "@/lib/listing-color";

export type CalendarBooking = {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_php: number;
  listings?: { title: string } | null;
  guest_name_snapshot?: string | null;
};

const MAX_LANES = 3;
const LANE_HEIGHT = 22;
const LANE_GAP = 2;
const HEADER_HEIGHT = 22;
const OVERFLOW_HEIGHT = 16;
const CELL_MIN_HEIGHT =
  HEADER_HEIGHT + MAX_LANES * LANE_HEIGHT + (MAX_LANES - 1) * LANE_GAP + OVERFLOW_HEIGHT + 8;

type Segment = {
  booking: CalendarBooking;
  colStart: number;
  colSpan: number;
  lane: number;
};

function buildWeekSegments(bookings: CalendarBooking[], weekStart: Date): Segment[] {
  const weekEndExclusive = addDays(weekStart, 7);
  const overlapping = bookings
    .map((b) => {
      const ci = parseISO(b.check_in);
      const co = parseISO(b.check_out);
      if (co <= weekStart || ci >= weekEndExclusive) return null;
      const segStart = ci < weekStart ? weekStart : ci;
      const segEnd = co > weekEndExclusive ? weekEndExclusive : co;
      const colStart = differenceInCalendarDays(segStart, weekStart);
      const colSpan = Math.max(1, differenceInCalendarDays(segEnd, segStart));
      return { booking: b, ci, colStart, colSpan };
    })
    .filter(Boolean) as Array<{
      booking: CalendarBooking; ci: Date; colStart: number; colSpan: number;
    }>;

  overlapping.sort((a, b) => {
    if (a.ci.getTime() !== b.ci.getTime()) return a.ci.getTime() - b.ci.getTime();
    return b.colSpan - a.colSpan;
  });

  const lanes: boolean[][] = [];
  const segments: Segment[] = [];
  for (const seg of overlapping) {
    let lane = 0;
    while (true) {
      if (!lanes[lane]) lanes[lane] = Array(7).fill(false);
      let fits = true;
      for (let i = seg.colStart; i < seg.colStart + seg.colSpan; i++) {
        if (lanes[lane][i]) { fits = false; break; }
      }
      if (fits) {
        for (let i = seg.colStart; i < seg.colStart + seg.colSpan; i++) lanes[lane][i] = true;
        break;
      }
      lane++;
    }
    segments.push({ booking: seg.booking, colStart: seg.colStart, colSpan: seg.colSpan, lane });
  }
  return segments;
}

function statusModifier(status: string): string {
  if (status === "cancelled" || status === "no_show") return "opacity-50 line-through";
  return "";
}

function statusBorder(status: string): string {
  if (status === "pending") return "border-l-2 border-dashed border-amber-300 dark:border-amber-500";
  return "";
}

function guestFirstName(b: CalendarBooking): string {
  const snap = b.guest_name_snapshot?.trim();
  if (!snap) return "";
  return snap.split(" ")[0] ?? snap;
}

type WeekRowProps = {
  weekStart: Date;
  bookings: CalendarBooking[];
  contextMonth?: Date;
  today: Date;
  showDayName?: boolean;
  onSelectBooking: (id: string) => void;
  onOpenDay: (day: Date) => void;
};

export function AdminBookingsWeekRow({
  weekStart,
  bookings,
  contextMonth,
  today,
  showDayName = false,
  onSelectBooking,
  onOpenDay,
}: WeekRowProps) {
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const segments = useMemo(() => buildWeekSegments(bookings, weekStart), [bookings, weekStart]);
  const visible = segments.filter((s) => s.lane < MAX_LANES);
  const overflow = segments.filter((s) => s.lane >= MAX_LANES);
  const overflowByDay: Record<number, number> = {};
  for (const s of overflow) {
    for (let i = s.colStart; i < s.colStart + s.colSpan; i++) {
      overflowByDay[i] = (overflowByDay[i] ?? 0) + 1;
    }
  }

  return (
    <div
      className="relative grid grid-cols-7 gap-1"
      style={{ minHeight: CELL_MIN_HEIGHT }}
    >
      {week.map((day, colIdx) => {
        const inMonth = contextMonth ? isSameMonth(day, contextMonth) : true;
        const isToday = isSameDay(day, today);
        const overflowCount = overflowByDay[colIdx] ?? 0;
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onOpenDay(day)}
            className={cn(
              "text-left rounded-md border border-border/40 transition-colors hover:border-primary/60 p-1 relative",
              inMonth ? "bg-background" : "bg-muted/30",
              isToday && "ring-1 ring-primary",
            )}
            style={{ minHeight: CELL_MIN_HEIGHT }}
          >
            <span
              className={cn(
                "absolute top-1 left-1.5 text-[11px] font-semibold tabular-nums leading-none",
                isToday
                  ? "text-primary"
                  : inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/60",
              )}
            >
              {showDayName ? format(day, "EEE d") : format(day, "d")}
            </span>
            {overflowCount > 0 && (
              <span
                className="absolute left-1 right-1 bottom-1 text-[10px] font-medium text-muted-foreground hover:text-foreground text-left"
              >
                +{overflowCount} more
              </span>
            )}
          </button>
        );
      })}

      {visible.map((seg) => {
        const color = listingColor(seg.booking.listing_id);
        const title = seg.booking.listings?.title ?? "Listing";
        const guest = guestFirstName(seg.booking);
        const label = guest ? `${title} · ${guest}` : title;
        const top = HEADER_HEIGHT + 4 + seg.lane * (LANE_HEIGHT + LANE_GAP);
        return (
          <button
            key={`${seg.booking.id}-${seg.colStart}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectBooking(seg.booking.id);
            }}
            title={`${title} · ${seg.booking.status} · ₱${seg.booking.total_php.toLocaleString()}`}
            className={cn(
              "absolute truncate text-left text-[11px] font-medium rounded-sm px-1.5 shadow-sm",
              color.bar,
              color.barText,
              statusModifier(seg.booking.status),
              statusBorder(seg.booking.status),
              "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/60",
            )}
            style={{
              top,
              height: LANE_HEIGHT,
              lineHeight: `${LANE_HEIGHT}px`,
              left: `calc(${(seg.colStart / 7) * 100}% + 4px)`,
              width: `calc(${(seg.colSpan / 7) * 100}% - 8px)`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  month: Date;
  bookings: CalendarBooking[];
  onSelectBooking: (id: string) => void;
  onOpenDay: (day: Date) => void;
};

export function AdminBookingsMonthGrid({ month, bookings, onSelectBooking, onOpenDay }: Props) {
  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const out: Date[] = [];
    for (let i = 0; i < allDays.length; i += 7) out.push(allDays[i]);
    return out;
  }, [month]);

  const today = new Date();

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((weekStart) => (
          <AdminBookingsWeekRow
            key={weekStart.toISOString()}
            weekStart={weekStart}
            bookings={bookings}
            contextMonth={month}
            today={today}
            onSelectBooking={onSelectBooking}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </div>
  );
}
