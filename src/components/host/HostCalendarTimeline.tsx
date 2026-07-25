import { useMemo } from "react";
import {
  addDays, differenceInMinutes, endOfDay, format, isSameDay, parseISO,
  startOfDay, startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";

type BookingRow = {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  starts_at: string | null;
  ends_at: string | null;
  stay_type: string;
  flow_state: string;
  status: string;
  payment_status: string;
  total_php: number;
  guest_id: string | null;
  listings: { title: string } | null;
};

type BlackoutRow = {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  stay_type: "hourly" | "overnight" | "both";
  reason: string | null;
};

type Props = {
  bookings: BookingRow[];
  blackouts: BlackoutRow[];
  anchorDate: Date;
  viewMode: "day" | "week";
  onOpenBooking: (bookingId: string) => void;
};

// 6 AM to 10 PM — configurable if we ever want a wider window.
const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 56; // px per hour row
const TIME_COL_WIDTH = 60; // px

const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

function formatHourLabel(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh} ${period}`;
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function pxOffsetForMinutesFromWindowStart(min: number): number {
  return (min / 60) * HOUR_HEIGHT;
}

// Rich color scheme keyed by event category. Both light + dark variants.
function bookingClasses(b: BookingRow): { chip: string; leftBar: string; label: string } {
  const isVoucher = b.stay_type === "voucher";
  const isHourly = b.stay_type === "hourly" || (b.starts_at !== null && b.ends_at !== null);
  const isPending = b.status === "pending" || b.flow_state === "requested" || b.flow_state === "payment_pending";

  if (isPending) return {
    chip: "bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500/60 text-amber-900 dark:text-amber-100",
    leftBar: "bg-amber-500",
    label: "Pending",
  };
  if (isVoucher) return {
    chip: "bg-primary/15 dark:bg-primary/25 border-primary/50 text-foreground",
    leftBar: "bg-primary",
    label: "Voucher",
  };
  if (isHourly) return {
    chip: "bg-sky-100 dark:bg-sky-950/60 border-sky-400 dark:border-sky-500/60 text-sky-900 dark:text-sky-100",
    leftBar: "bg-sky-500",
    label: "Hourly",
  };
  return {
    chip: "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500/60 text-emerald-900 dark:text-emerald-100",
    leftBar: "bg-emerald-500",
    label: "Overnight",
  };
}

function blackoutClasses(bl: BlackoutRow): { chip: string; leftBar: string; label: string } {
  const isHourly = bl.stay_type === "hourly";
  if (isHourly) return {
    chip: "bg-amber-100/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500/50 text-amber-900 dark:text-amber-100 border-dashed",
    leftBar: "bg-amber-500",
    label: "Blocked (hourly)",
  };
  return {
    chip: "bg-slate-200/70 dark:bg-slate-800/60 border-slate-400 dark:border-slate-500/60 text-slate-900 dark:text-slate-100 border-dashed",
    leftBar: "bg-slate-500",
    label: bl.stay_type === "both" ? "Blocked" : "Blocked (overnight)",
  };
}

export function HostCalendarTimeline({ bookings, blackouts, anchorDate, viewMode, onOpenBooking }: Props) {
  const days = useMemo(() => {
    if (viewMode === "day") return [anchorDate];
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [anchorDate, viewMode]);

  // Split events into (a) all-day items (overnight bookings + full-day blackouts)
  // and (b) timed items (hourly bookings + hour-specific blackouts).
  const allDayItems = useMemo(() => {
    const items: Array<
      | { kind: "booking"; dayIdx: number; row: BookingRow }
      | { kind: "blackout"; dayIdx: number; row: BlackoutRow }
    > = [];
    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      for (const b of bookings) {
        const isHourly = b.starts_at !== null && b.ends_at !== null;
        if (isHourly) continue;
        const ci = parseISO(b.check_in);
        const co = parseISO(b.check_out);
        if (day >= startOfDay(ci) && day < startOfDay(co)) items.push({ kind: "booking", dayIdx: d, row: b });
      }
      for (const bl of blackouts) {
        if (bl.start_time && bl.end_time) continue;
        const s = parseISO(bl.start_date);
        const e = parseISO(bl.end_date);
        if (day >= startOfDay(s) && day <= endOfDay(e)) items.push({ kind: "blackout", dayIdx: d, row: bl });
      }
    }
    return items;
  }, [bookings, blackouts, days]);

  // Timed items get computed offsets. Skip items outside the visible hour window.
  const timedItemsPerDay = useMemo(() => {
    const perDay: Array<Array<
      | { kind: "booking"; row: BookingRow; topPx: number; heightPx: number; label: string }
      | { kind: "blackout"; row: BlackoutRow; topPx: number; heightPx: number; label: string }
    >> = days.map(() => []);
    const windowStartMin = START_HOUR * 60;
    const windowEndMin = END_HOUR * 60 + 60; // include the END_HOUR row

    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      const dayStart = startOfDay(day);

      // Hourly bookings via starts_at / ends_at
      for (const b of bookings) {
        if (!b.starts_at || !b.ends_at) continue;
        const s = parseISO(b.starts_at);
        const e = parseISO(b.ends_at);
        if (!isSameDay(s, day) && !isSameDay(e, day) && (s < dayStart || e > endOfDay(day))) continue;
        if (!isSameDay(s, day) && !(s < dayStart && e > dayStart)) continue;
        // Clamp to day
        const startMin = Math.max(differenceInMinutes(s, dayStart), 0);
        const endMin = Math.min(differenceInMinutes(e, dayStart), 24 * 60);
        if (endMin <= windowStartMin || startMin >= windowEndMin) continue;
        const clampedStart = Math.max(startMin, windowStartMin);
        const clampedEnd = Math.min(endMin, windowEndMin);
        perDay[d].push({
          kind: "booking",
          row: b,
          topPx: pxOffsetForMinutesFromWindowStart(clampedStart - windowStartMin),
          heightPx: pxOffsetForMinutesFromWindowStart(clampedEnd - clampedStart),
          label: `${format(s, "h:mm a")} – ${format(e, "h:mm a")}`,
        });
      }

      // Hour-specific blackouts
      for (const bl of blackouts) {
        if (!bl.start_time || !bl.end_time) continue;
        const s = parseISO(bl.start_date);
        if (!isSameDay(s, day)) continue;
        const startMin = timeStrToMinutes(bl.start_time);
        const endMin = timeStrToMinutes(bl.end_time);
        if (endMin <= windowStartMin || startMin >= windowEndMin) continue;
        const clampedStart = Math.max(startMin, windowStartMin);
        const clampedEnd = Math.min(endMin, windowEndMin);
        perDay[d].push({
          kind: "blackout",
          row: bl,
          topPx: pxOffsetForMinutesFromWindowStart(clampedStart - windowStartMin),
          heightPx: pxOffsetForMinutesFromWindowStart(clampedEnd - clampedStart),
          label: `${bl.start_time.slice(0, 5)} – ${bl.end_time.slice(0, 5)}`,
        });
      }
    }
    return perDay;
  }, [bookings, blackouts, days]);

  const now = new Date();
  const showNowLine = days.some((d) => isSameDay(d, now));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowInWindow = nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60 + 60;
  const nowTopPx = pxOffsetForMinutesFromWindowStart(nowMin - START_HOUR * 60);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      {/* Day header row */}
      <div
        className="grid border-b border-border/60 bg-secondary/30"
        style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={cn(
            "px-3 py-2 text-center border-l border-border/60",
            isSameDay(d, now) && "bg-primary/5",
          )}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {format(d, viewMode === "day" ? "EEEE" : "EEE")}
            </div>
            <div className={cn(
              "text-sm font-semibold",
              isSameDay(d, now) && "text-primary",
            )}>
              {format(d, "MMM d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day strip (only shown when there's at least one all-day item) */}
      {allDayItems.length > 0 && (
        <div
          className="grid border-b border-border/60 bg-background"
          style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground text-right border-r border-border/40">
            All day
          </div>
          {days.map((_, d) => {
            const cellItems = allDayItems.filter((it) => it.dayIdx === d);
            return (
              <div key={d} className="p-1 border-l border-border/40 space-y-1 min-h-[36px]">
                {cellItems.map((it) => {
                  if (it.kind === "booking") {
                    const styles = bookingClasses(it.row);
                    return (
                      <button
                        key={`b-${it.row.id}`}
                        type="button"
                        onClick={() => onOpenBooking(it.row.id)}
                        className={cn(
                          "w-full text-left rounded px-2 py-1 text-[11px] border truncate transition-colors",
                          styles.chip, "hover:brightness-105",
                        )}
                        title={`${it.row.listings?.title ?? "Listing"} · ${styles.label}`}
                      >
                        <span className="font-medium truncate">
                          {it.row.listings?.title ?? "Listing"}
                        </span>
                      </button>
                    );
                  }
                  const styles = blackoutClasses(it.row);
                  return (
                    <div
                      key={`bl-${it.row.id}`}
                      className={cn(
                        "w-full rounded px-2 py-1 text-[11px] border truncate",
                        styles.chip,
                      )}
                      title={it.row.reason ?? styles.label}
                    >
                      <span className="font-medium">{styles.label}</span>
                      {it.row.reason && <span className="ml-1 opacity-70">· {it.row.reason}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Hour grid */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {/* Time column */}
        <div className="border-r border-border/40">
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-[10px] text-muted-foreground text-right pr-2 border-t border-border/40"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="-translate-y-2 inline-block">{formatHourLabel(h)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, d) => (
          <div
            key={day.toISOString()}
            className={cn(
              "relative border-l border-border/40",
              isSameDay(day, now) && "bg-primary/5",
            )}
            style={{ height: HOURS.length * HOUR_HEIGHT }}
          >
            {/* Hour grid lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-t border-border/40"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Now line */}
            {showNowLine && isSameDay(day, now) && nowInWindow && (
              <div
                className="absolute left-0 right-0 pointer-events-none z-20 h-px bg-primary"
                style={{ top: nowTopPx }}
              >
                <span className="absolute left-0 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
              </div>
            )}

            {/* Timed events */}
            {timedItemsPerDay[d].map((it) => {
              const styles = it.kind === "booking" ? bookingClasses(it.row) : blackoutClasses(it.row);
              const isBooking = it.kind === "booking";
              const inner = (
                <>
                  <span className={cn("absolute left-0 top-0 bottom-0 w-1", styles.leftBar)} />
                  <div className="pl-2 pr-1.5 py-1 h-full overflow-hidden">
                    <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {styles.label}
                    </div>
                    <div className="text-xs font-medium truncate">
                      {isBooking ? (it.row.listings?.title ?? "Listing") : "Blocked"}
                    </div>
                    <div className="text-[10px] opacity-75 truncate">{it.label}</div>
                    {!isBooking && it.row.reason && (
                      <div className="text-[10px] opacity-75 truncate italic">{it.row.reason}</div>
                    )}
                  </div>
                </>
              );
              const commonClasses = cn(
                "absolute left-1 right-1 rounded border text-xs overflow-hidden shadow-sm",
                styles.chip,
              );
              const style = { top: it.topPx, height: Math.max(it.heightPx, 22) };
              if (isBooking) {
                return (
                  <button
                    key={`t-b-${it.row.id}`}
                    type="button"
                    onClick={() => onOpenBooking(it.row.id)}
                    className={cn(commonClasses, "text-left hover:brightness-105 cursor-pointer")}
                    style={style}
                    title={`${it.row.listings?.title ?? "Listing"} · ${styles.label} · ${it.label}`}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div
                  key={`t-bl-${it.row.id}`}
                  className={commonClasses}
                  style={style}
                  title={it.row.reason ?? styles.label}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
