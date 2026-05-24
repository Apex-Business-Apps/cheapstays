import { useState, useMemo } from "react";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchListing } from "@/types/pip";

type Props = {
  listing: SearchListing;
  /** Called when user taps back arrow */
  onCancel: () => void;
  /** Called when user confirms — caller makes the API request */
  onConfirm: (params: {
    listing_id: string;
    check_in: string;
    check_out: string;
    guests: number;
  }) => void;
  loading: boolean;
};

/** Formats YYYY-MM-DD → "Mon D, YYYY" for display */
function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Returns today's date as YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns (today + offset days) as YYYY-MM-DD */
function daysFrom(base: string, n: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

export function PipBookingPanel({ listing, onCancel, onConfirm, loading }: Props) {
  const { t } = useTranslation();

  const minCheckIn = today();
  const [checkIn, setCheckIn] = useState(daysFrom(minCheckIn, 1));
  const [checkOut, setCheckOut] = useState(daysFrom(minCheckIn, 1 + Math.max(listing.min_nights, 2)));
  const [guests, setGuests] = useState(1);

  const nights = nightsBetween(checkIn, checkOut);
  const subtotal = nights * listing.nightly_php;
  const serviceFee = Math.round(subtotal * 0.05);
  const total = subtotal + serviceFee;

  const isValid = useMemo(
    () => checkIn >= minCheckIn && checkOut > checkIn && nights >= listing.min_nights && guests >= 1 && guests <= listing.max_guests,
    [checkIn, checkOut, nights, listing.min_nights, listing.max_guests, guests, minCheckIn],
  );

  function adjustGuests(delta: number) {
    setGuests((g) => Math.min(listing.max_guests, Math.max(1, g + delta)));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("pip.cancelBtn")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{t("pip.confirmBooking")}</p>
          <p className="text-[11px] text-muted-foreground truncate">{listing.title}</p>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Dates */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Dates
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Check-in</p>
              <input
                type="date"
                value={checkIn}
                min={minCheckIn}
                onChange={(e) => {
                  const v = e.target.value;
                  setCheckIn(v);
                  if (checkOut <= v) setCheckOut(daysFrom(v, listing.min_nights));
                }}
                className={cn(
                  "w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-primary",
                )}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Check-out</p>
              <input
                type="date"
                value={checkOut}
                min={daysFrom(checkIn, listing.min_nights)}
                onChange={(e) => setCheckOut(e.target.value)}
                className={cn(
                  "w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-primary",
                )}
              />
            </div>
          </div>
          {nights > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {fmtDate(checkIn)} → {fmtDate(checkOut)}
              {" · "}
              {t("pip.nights", { count: nights })}
            </p>
          )}
          {nights < listing.min_nights && nights > 0 && (
            <p className="text-[11px] text-destructive">
              Min stay: {listing.min_nights} night{listing.min_nights !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Guests */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Guests
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustGuests(-1)}
              disabled={guests <= 1}
              className="grid h-7 w-7 place-items-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-40 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-sm font-medium w-6 text-center">{guests}</span>
            <button
              onClick={() => adjustGuests(1)}
              disabled={guests >= listing.max_guests}
              className="grid h-7 w-7 place-items-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
            <span className="text-[11px] text-muted-foreground ml-1">
              max {listing.max_guests}
            </span>
          </div>
        </div>

        {/* Price breakdown */}
        {nights >= listing.min_nights && (
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-medium">{t("pip.bookingSummary")}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  ₱{listing.nightly_php.toLocaleString()} × {nights} {nights === 1 ? "night" : "nights"}
                </span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pip.serviceFee")}</span>
                <span>₱{serviceFee.toLocaleString()}</span>
              </div>
              <div className="border-t border-border/50 pt-1.5 mt-1.5 flex justify-between font-semibold">
                <span>{t("pip.total")}</span>
                <span className="text-primary">₱{total.toLocaleString()}</span>
              </div>
            </div>
            {listing.instant_book && (
              <p className="text-[10px] text-primary font-medium">
                ⚡ {t("pip.instantBookBadge")} — confirmed immediately
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="px-4 pb-3 pt-2 border-t border-border/60 flex gap-2">
        <Button
          variant="outline"
          className="flex-1 h-9 text-sm"
          onClick={onCancel}
          disabled={loading}
        >
          {t("pip.cancelBtn")}
        </Button>
        <Button
          className="flex-1 h-9 text-sm"
          disabled={!isValid || loading}
          onClick={() =>
            onConfirm({ listing_id: listing.id, check_in: checkIn, check_out: checkOut, guests })
          }
        >
          {loading ? "…" : t("pip.confirmBtn")}
        </Button>
      </div>
    </div>
  );
}
