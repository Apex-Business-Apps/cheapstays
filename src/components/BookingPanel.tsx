import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInCalendarDays, eachDayOfInterval, isWithinInterval, parseISO, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, ChevronDown, Loader2, Users, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Listing = {
  id: string;
  nightly_php: number;
  min_nights: number;
  max_guests: number;
  instant_book: boolean;
};

type BookedInterval = { start: Date; end: Date };

type Props = { listing: Listing };

const SERVICE_FEE_RATE = 0.05;

export function BookingPanel({ listing }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [message, setMessage] = useState("");
  const [bookedDates, setBookedDates] = useState<BookedInterval[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("bookings")
      .select("check_in,check_out")
      .eq("listing_id", listing.id)
      .in("status", ["confirmed", "pending"])
      .then(({ data }) => {
        if (!data) return;
        setBookedDates(
          data.map((b) => ({
            start: parseISO(b.check_in),
            end: parseISO(b.check_out),
          }))
        );
      });
  }, [listing.id]);

  function isDateBooked(date: Date) {
    return bookedDates.some((interval) =>
      isWithinInterval(date, { start: interval.start, end: addDays(interval.end, -1) })
    );
  }

  function hasBookedDayInRange(from: Date, to: Date) {
    return eachDayOfInterval({ start: from, end: addDays(to, -1) }).some(isDateBooked);
  }

  const nights =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from)
      : 0;

  const subtotal = nights * listing.nightly_php;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const total = subtotal + serviceFee;

  const rangeInvalid =
    range?.from && range?.to && hasBookedDayInRange(range.from, range.to);
  const tooShort = nights > 0 && nights < listing.min_nights;
  const canBook =
    range?.from &&
    range?.to &&
    nights >= listing.min_nights &&
    !rangeInvalid &&
    guests >= 1 &&
    guests <= listing.max_guests;

  async function book() {
    if (!user) { navigate("/auth"); return; }
    if (!canBook || !range?.from || !range?.to) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("book-listing", {
        body: {
          listing_id: listing.id,
          check_in: format(range.from, "yyyy-MM-dd"),
          check_out: format(range.to, "yyyy-MM-dd"),
          guests,
          guest_message: message.trim() || undefined,
        },
      });
      if (error) throw error;
      setConfirmed(true);
    } catch (err) {
      toast({ title: "Booking failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
        <p className="font-semibold text-lg">
          {listing.instant_book ? "Booking confirmed!" : "Request sent!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {listing.instant_book
            ? "You're booked. Check your email for details."
            : "The host will confirm within 24 hours."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-bold">₱{listing.nightly_php.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground"> / night</span>
        </div>
        {listing.instant_book && (
          <span className="flex items-center gap-1 text-xs text-primary font-medium">
            <Zap className="h-3.5 w-3.5" /> Instant book
          </span>
        )}
      </div>

      {/* Date picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-sm text-left hover:border-primary/40 transition-colors">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            {range?.from ? (
              range.to ? (
                <span>
                  {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
                </span>
              ) : (
                <span>{format(range.from, "MMM d, yyyy")} – pick checkout</span>
              )
            ) : (
              <span className="text-muted-foreground">Select dates</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) => {
              setRange(r);
              if (r?.from && r?.to) setCalOpen(false);
            }}
            disabled={(date) =>
              date < addDays(new Date(), 0) || isDateBooked(date)
            }
            numberOfMonths={2}
            initialFocus
          />
          {listing.min_nights > 1 && (
            <p className="text-xs text-muted-foreground text-center pb-2">
              Minimum {listing.min_nights} nights
            </p>
          )}
        </PopoverContent>
      </Popover>

      {/* Guests */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" /> Guests
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
            className="h-6 w-6 rounded-full border border-border/60 text-sm flex items-center justify-center hover:border-foreground/30 transition-colors"
          >
            –
          </button>
          <span className="text-sm w-4 text-center">{guests}</span>
          <button
            type="button"
            onClick={() => setGuests((g) => Math.min(listing.max_guests, g + 1))}
            className="h-6 w-6 rounded-full border border-border/60 text-sm flex items-center justify-center hover:border-foreground/30 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Validation hints */}
      {tooShort && (
        <p className="text-xs text-destructive">
          Minimum stay is {listing.min_nights} nights — select at least {listing.min_nights} nights.
        </p>
      )}
      {rangeInvalid && (
        <p className="text-xs text-destructive">
          Those dates include nights that are already booked. Please choose different dates.
        </p>
      )}

      {/* Price breakdown */}
      {nights >= listing.min_nights && !rangeInvalid && (
        <div className="space-y-1.5 text-sm border-t border-border/60 pt-3">
          <div className="flex justify-between text-muted-foreground">
            <span>₱{listing.nightly_php.toLocaleString()} × {nights} nights</span>
            <span>₱{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Service fee (5%)</span>
            <span>₱{serviceFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border/60 pt-1.5">
            <span>Total</span>
            <span>₱{total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Message */}
      <Textarea
        placeholder="Message to host (optional)"
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="text-sm"
      />

      <Button
        className="w-full"
        disabled={!canBook || submitting}
        onClick={user ? book : () => navigate("/auth")}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !user ? (
          "Sign in to book"
        ) : listing.instant_book ? (
          "Book now"
        ) : (
          "Request to book"
        )}
      </Button>

      {canBook && (
        <p className="text-xs text-center text-muted-foreground">
          {listing.instant_book ? "You won't be charged yet." : "No charge until the host confirms."}
        </p>
      )}
    </div>
  );
}
