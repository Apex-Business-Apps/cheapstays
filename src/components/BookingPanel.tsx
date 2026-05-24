import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, differenceInCalendarDays, eachDayOfInterval, isWithinInterval, parseISO, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, ChevronDown, CreditCard, Loader2, Smartphone, Users, Wallet, Zap, CheckCircle2 } from "lucide-react";
import { LegalScrollGate } from "@/components/LegalScrollGate";
import { CardHoldForm } from "@/components/CardHoldForm";
import { legalDocs } from "@/pages/legal/content";
import { isMember } from "@/lib/rbac";

type Listing = {
  id: string;
  nightly_php: number;
  min_nights: number;
  max_guests: number;
  instant_book: boolean;
};

type BookedInterval = { start: Date; end: Date };

type Props = { listing: Listing };

type Step = "form" | "pay" | "done";
type PayMethod = "gcash" | "maya" | "card";

const SERVICE_FEE_RATE = 0.05;

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

const RENTER_RULES = legalDocs["renter-rules"];
const RENTER_RULES_HASH = djb2(RENTER_RULES.markdown);

const PAYMENT_METHODS: { id: PayMethod; label: string; Icon: React.ElementType; description: string }[] = [
  { id: "gcash", label: "GCash", Icon: Smartphone, description: "Pay via GCash e-wallet" },
  { id: "maya", label: "Maya", Icon: Wallet, description: "Pay via Maya (PayMaya)" },
  { id: "card", label: "Credit / Debit card", Icon: CreditCard, description: "Visa, Mastercard, JCB" },
];

export function BookingPanel({ listing }: Props) {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const effectiveInstantBook = listing.instant_book && isMember(roles);

  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [message, setMessage] = useState("");
  const [bookedDates, setBookedDates] = useState<BookedInterval[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("gcash");
  const [paying, setPaying] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [showLegalGate, setShowLegalGate] = useState(false);

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
      const { data, error } = await supabase.functions.invoke("book-listing", {
        body: {
          listing_id: listing.id,
          check_in: format(range.from, "yyyy-MM-dd"),
          check_out: format(range.to, "yyyy-MM-dd"),
          guests,
          guest_message: message.trim() || undefined,
        },
      });
      if (error) throw error;
      setBookingId(data.booking_id);
      if (data.status === "confirmed") {
        setStep("pay");
      } else {
        setStep("done");
      }
    } catch (err) {
      toast({ title: "Booking failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function pay() {
    if (!bookingId) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-checkout", {
        body: { booking_id: bookingId, payment_method: payMethod },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url as string;
        return;
      }
      // Payment not configured — booking is still valid, just pay at check-in
      toast({ title: "Online payment unavailable", description: "Your booking is confirmed. You can pay at check-in." });
      setStep("done");
    } catch (err) {
      toast({ title: "Payment error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  }

  if (step === "pay") {
    const WALLET_METHODS = PAYMENT_METHODS.filter((m) => m.id !== "card");

    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-5">
        <div className="text-center space-y-1">
          <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
          <p className="font-semibold text-lg">Almost there — secure your stay</p>
          <p className="text-sm text-muted-foreground">
            Full payment must be held before your reservation is complete.
          </p>
        </div>

        <div className="space-y-2">
          {PAYMENT_METHODS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPayMethod(id)}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                payMethod === id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {id === "card"
                    ? "Card held now — charged on check-in day"
                    : id === "gcash"
                    ? "Pay now via GCash e-wallet"
                    : "Pay now via Maya (PayMaya)"}
                </p>
              </div>
            </button>
          ))}
        </div>

        {payMethod === "card" ? (
          <CardHoldForm
            bookingId={bookingId!}
            totalPhp={total}
            onSuccess={() => setStep("done")}
          />
        ) : (
          <>
            <Button className="w-full" onClick={pay} disabled={paying}>
              {paying
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : `Pay with ${WALLET_METHODS.find((m) => m.id === payMethod)?.label}`}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              You will be redirected to complete payment.
            </p>
          </>
        )}
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
        <p className="font-semibold text-lg">
          {effectiveInstantBook ? "Booking confirmed!" : "Request sent!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {effectiveInstantBook
            ? "You're booked. Check your email for details."
            : "The host will confirm within 24 hours."}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button asChild>
            <Link to="/my-bookings">View your bookings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/search">Find another stay</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-bold">₱{listing.nightly_php.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground"> / night</span>
          </div>
          {listing.instant_book && (
            <span className="flex items-center gap-1 text-xs text-primary font-medium">
              <Zap className="h-3.5 w-3.5" /> Instant book
              {!effectiveInstantBook && user && <span className="text-muted-foreground">(Members only)</span>}
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
          onClick={user ? () => setShowLegalGate(true) : () => navigate("/auth")}
          aria-label={effectiveInstantBook ? "Book now" : "Request to book"}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !user ? (
            "Sign in to book"
          ) : effectiveInstantBook ? (
            "Book now"
          ) : (
            "Request to book"
          )}
        </Button>

        {canBook && (
          <p className="text-xs text-center text-muted-foreground">
            {effectiveInstantBook ? "You won't be charged yet." : "No charge until the host confirms."}
          </p>
        )}
        {listing.instant_book && !effectiveInstantBook && user && (
          <p className="text-xs text-center text-muted-foreground">
            <Link to="/membership" className="underline underline-offset-2 hover:text-foreground">Upgrade to Member</Link>
            {" "}to unlock instant booking on this listing.
          </p>
        )}
      </div>

      {user && (
        <Dialog open={showLegalGate} onOpenChange={setShowLegalGate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Renter Rules</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2 mb-1">
              Please read and accept our renter rules before booking.
            </p>
            <LegalScrollGate
              userId={user.id}
              role="guest"
              contextId={listing.id}
              documentId="renter-rules"
              documentVersion={RENTER_RULES.version}
              documentHash={RENTER_RULES_HASH}
              checkboxLabel="I have read and agree to the Renter Rules."
              legalContent={
                <p className="text-sm whitespace-pre-wrap leading-relaxed font-sans">
                  {RENTER_RULES.markdown}
                </p>
              }
              onAccepted={async () => {
                setShowLegalGate(false);
                await book();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
