import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format, differenceInCalendarDays, eachDayOfInterval, isWithinInterval, parseISO, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// listing_house_rules is not yet in auto-generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type HouseRulesRow = {
  current_version: string;
  current_hash: string;
  rules_json: { text: string };
};
import { toast } from "@/hooks/use-toast";
import { CalendarDays, ChevronDown, CreditCard, Loader2, Smartphone, Users, Wallet, Zap, CheckCircle2, Clock } from "lucide-react";
import { LegalScrollGate } from "@/components/LegalScrollGate";
import { legalDocs } from "@/pages/legal/content";

// Canonical stay-length boundary — must match book-listing edge function.
const SHORT_TERM_MAX_NIGHTS = 30;

type Listing = {
  id: string;
  nightly_php: number;
  min_nights: number;
  max_guests: number;
  max_nights?: number | null;
  short_term_enabled?: boolean;
  long_term_enabled?: boolean;
  stay_availability_type?: "overnight" | "hourly" | "both" | null;
  booking_mode?: "instant" | "voucher" | "manual_review" | null;
  hourly_php?: number | null;
  price_3h?: number | null;
  price_6h?: number | null;
  price_12h?: number | null;
  promo_price?: number | null;
};

type BookedInterval = { start: Date; end: Date };
// A booked hourly slot, expressed as a half-open hour range [startHour, endHour)
// on a specific calendar date (yyyy-MM-dd).
type HourlyBusy = { date: string; startHour: number; endHour: number };

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

// supabase-js surfaces edge-function failures as FunctionsHttpError whose
// `.message` is the generic "Edge Function returned a non-2xx status code".
// The real error body lives in `error.context` (a Response). Unwrap it so the
// user sees the actual reason (e.g. "You cannot book your own listing").
async function fnErrorMessage(
  error: unknown,
  data: { error?: unknown; message?: string; detail?: string } | null,
  fallback: string,
): Promise<string> {
  if (data?.message) return data.message;
  if (typeof data?.error === "string") return data.detail ? `${data.error}: ${data.detail}` : data.error;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (typeof body?.error === "string") return body?.detail ? `${body.error}: ${body.detail}` : body.error;
      if (typeof body?.message === "string") return body.message;
    } catch { /* response body wasn't JSON — fall through */ }
  }
  return (error as Error | null)?.message ?? fallback;
}

export function BookingPanel({ listing }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultMode = listing.booking_mode === "voucher"
    ? "voucher"
    : (listing.stay_availability_type === "hourly" ? "hourly" : "overnight");

  // Restore any selection a guest made before being sent to sign in, so they
  // land back on this listing exactly where they left off (see goToAuth).
  const parseDateParam = (key: string): Date | undefined => {
    const v = searchParams.get(key);
    if (!v) return undefined;
    try { return parseISO(v); } catch { return undefined; }
  };
  const paramMode = searchParams.get("mode");
  const initialMode: "overnight" | "hourly" | "voucher" =
    paramMode === "overnight" || paramMode === "hourly" || paramMode === "voucher"
      ? paramMode
      : defaultMode;
  const paramBlock = searchParams.get("block");
  const initialBlock: "base" | "3h" | "6h" | "12h" =
    paramBlock === "3h" || paramBlock === "6h" || paramBlock === "12h" ? paramBlock : "base";
  const ci = parseDateParam("check_in");
  const co = parseDateParam("check_out");

  const [stayMode, setStayMode] = useState<"overnight" | "hourly" | "voucher">(initialMode);

  const [range, setRange] = useState<DateRange | undefined>(
    ci && co ? { from: ci, to: co } : undefined,
  );
  const [hourlyDate, setHourlyDate] = useState<Date | undefined>(initialMode === "hourly" ? ci : undefined);
  const [hourlyBlock, setHourlyBlock] = useState<"base" | "3h" | "6h" | "12h">(initialBlock);
  const [arrivalTime, setArrivalTime] = useState<string>(searchParams.get("arrival") ?? "14:00");

  const [guests, setGuests] = useState(Math.max(1, Number(searchParams.get("guests")) || 1));
  const [message, setMessage] = useState("");
  const [bookedDates, setBookedDates] = useState<BookedInterval[]>([]);
  const [hourlyBusy, setHourlyBusy] = useState<HourlyBusy[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("gcash");
  const [paying, setPaying] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [showLegalGate, setShowLegalGate] = useState(false);
  const [showHouseRulesGate, setShowHouseRulesGate] = useState(false);
  const [houseRules, setHouseRules] = useState<HouseRulesRow | null>(null);

  // Guest checkout (book without an account)
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAgree, setGuestAgree] = useState(false);
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  // Send a guest to sign in while preserving the listing path + their current
  // selection, so after auth (and first-time consent) they return here ready to
  // book in one click.
  function goToAuth() {
    const params = new URLSearchParams();
    params.set("mode", stayMode);
    params.set("guests", String(guests));
    if (stayMode === "overnight" && range?.from && range?.to) {
      params.set("check_in", format(range.from, "yyyy-MM-dd"));
      params.set("check_out", format(range.to, "yyyy-MM-dd"));
    } else if (stayMode === "hourly" && hourlyDate) {
      params.set("check_in", format(hourlyDate, "yyyy-MM-dd"));
      params.set("block", hourlyBlock);
      params.set("arrival", arrivalTime);
    }
    const redirect = `${window.location.pathname}?${params.toString()}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
  }

  useEffect(() => {
    // bookings RLS hides other users' rows, so read availability through a
    // SECURITY DEFINER RPC that returns only booked time ranges (no PII).
    sb.rpc("get_listing_booked_slots", { p_listing_id: listing.id })
      .then(({ data }: { data: Array<{ check_in: string; check_out: string; stay_type: string | null; arrival_time: string | null; duration_hours: number | null }> | null }) => {
        if (!data) return;
        const overnight: BookedInterval[] = [];
        const hourly: HourlyBusy[] = [];
        for (const b of data) {
          if (b.stay_type === "hourly" && b.arrival_time && b.duration_hours) {
            const startHour = parseInt(String(b.arrival_time).slice(0, 2), 10);
            if (!Number.isNaN(startHour)) {
              hourly.push({ date: b.check_in, startHour, endHour: startHour + Number(b.duration_hours) });
            }
          } else {
            // Overnight (and anything non-hourly) blocks whole days.
            overnight.push({ start: parseISO(b.check_in), end: parseISO(b.check_out) });
          }
        }
        setBookedDates(overnight);
        setHourlyBusy(hourly);
      });
  }, [listing.id]);

  useEffect(() => {
    sb.from("listing_house_rules")
      .select("current_version,current_hash,rules_json")
      .eq("listing_id", listing.id)
      .maybeSingle()
      .then(({ data }: { data: HouseRulesRow | null }) => {
        setHouseRules(data ?? null);
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

  // For hourly stays: does starting at `hour` (for the currently selected
  // duration block) collide with an already-booked slot on the selected date?
  function arrivalOverlaps(hour: number): boolean {
    if (!hourlyDate) return false;
    const dateStr = format(hourlyDate, "yyyy-MM-dd");
    const dur = hourlyBlock === "3h" ? 3 : hourlyBlock === "6h" ? 6 : hourlyBlock === "12h" ? 12 : 1;
    const reqEnd = hour + dur;
    return hourlyBusy.some((b) => b.date === dateStr && hour < b.endHour && reqEnd > b.startHour);
  }

  // Disable arrival hours already in the past when booking for today.
  function arrivalInPast(hour: number): boolean {
    if (!hourlyDate) return false;
    const now = new Date();
    return format(hourlyDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd") && hour <= now.getHours();
  }

  // Derived values based on mode
  let nights = 0;
  let subtotal = 0;
  let durationHours: number | null = null;
  let priceToUse = listing.nightly_php;
  let displayTotalText = "";

  if (stayMode === "overnight") {
    nights = range?.from && range?.to ? differenceInCalendarDays(range.to, range.from) : 0;
    subtotal = nights * listing.nightly_php;
    displayTotalText = `₱${listing.nightly_php.toLocaleString()} × ${nights} nights`;
  } else {
    // hourly or voucher
    nights = 1; // bypasses min_nights checks naturally or is hardcoded in edge function
    if (hourlyBlock === "3h") { priceToUse = listing.price_3h ?? (listing.hourly_php ?? 0) * 3; durationHours = 3; }
    else if (hourlyBlock === "6h") { priceToUse = listing.price_6h ?? (listing.hourly_php ?? 0) * 6; durationHours = 6; }
    else if (hourlyBlock === "12h") { priceToUse = listing.price_12h ?? (listing.hourly_php ?? 0) * 12; durationHours = 12; }
    else { priceToUse = listing.hourly_php ?? 0; durationHours = 1; }
    subtotal = priceToUse;
    displayTotalText = `₱${priceToUse.toLocaleString()} base price`;
  }

  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const total = subtotal + serviceFee;

  let canBook = false;
  let rangeInvalid = false;
  let tooShort = false;
  let tooLong = false;
  let stayLengthBlocked = false;
  let isShortTermStay = true;
  let isLongTermStay = false;
  let shortTermBlocked = false;
  let longTermBlocked = false;

  if (stayMode === "overnight") {
    rangeInvalid = !!(range?.from && range?.to && hasBookedDayInRange(range.from, range.to));
    tooShort = nights > 0 && nights < listing.min_nights;
    tooLong = nights > 0 && listing.max_nights != null && nights > listing.max_nights;
    isShortTermStay = nights > 0 && nights <= SHORT_TERM_MAX_NIGHTS;
    isLongTermStay = nights > SHORT_TERM_MAX_NIGHTS;
    
    shortTermBlocked = isShortTermStay && listing.short_term_enabled === false;
    longTermBlocked = isLongTermStay && listing.long_term_enabled !== true;
    stayLengthBlocked = shortTermBlocked || longTermBlocked;

    canBook = !!(range?.from && range?.to && nights >= listing.min_nights && !rangeInvalid && !tooLong && !stayLengthBlocked && guests >= 1 && guests <= listing.max_guests);
  } else if (stayMode === "hourly") {
    const arrivalHour = parseInt(arrivalTime.slice(0, 2), 10);
    const arrivalBlocked = !Number.isNaN(arrivalHour) && (arrivalOverlaps(arrivalHour) || arrivalInPast(arrivalHour));
    rangeInvalid = !!((hourlyDate && isDateBooked(hourlyDate)) || arrivalBlocked);
    canBook = !!(hourlyDate && arrivalTime && !rangeInvalid && guests >= 1 && guests <= listing.max_guests);
  } else if (stayMode === "voucher") {
    canBook = !!(guests >= 1 && guests <= listing.max_guests);
  }

  // Guest checkout covers instant-book stays only — vouchers and long-term
  // requests still need an account, so guests are sent to sign in for those.
  const guestEligible = stayMode !== "voucher" && !isLongTermStay;

  async function book() {
    if (!user) { goToAuth(); return; }
    if (!canBook) return;

    setSubmitting(true);
    try {
      if (stayMode === "voucher") {
        const { data, error } = await supabase.functions.invoke("purchase-voucher", {
          body: {
            listing_id: listing.id,
            duration_hours: durationHours,
            guests,
          },
        });
        if (error || data?.error) {
          throw new Error(await fnErrorMessage(error, data, "Purchase failed"));
        }
        setBookingId(data.voucher_id);
        setStep("pay");
      } else {
        const payload: Record<string, string | number | null | undefined> = {
          listing_id: listing.id,
          guests,
          guest_message: message.trim() || undefined,
        };

        if (stayMode === "overnight") {
          payload.check_in = format(range!.from!, "yyyy-MM-dd");
          payload.check_out = format(range!.to!, "yyyy-MM-dd");
        } else {
          payload.check_in = format(hourlyDate!, "yyyy-MM-dd");
          payload.check_out = format(addDays(hourlyDate!, 1), "yyyy-MM-dd");
          payload.stay_type = "hourly";
          payload.arrival_time = arrivalTime;
          payload.duration_hours = durationHours;
        }

        const { data, error } = await supabase.functions.invoke("book-listing", {
          body: payload,
        });
        
        if (error || data?.error) {
          throw new Error(await fnErrorMessage(error, data, "Booking failed"));
        }
        setBookingId(data.booking_id);
        
        if (data.booking_flow === "instant_book") {
          setStep("pay");
        } else {
          setStep("done");
        }
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
      const endpoint = stayMode === "voucher" ? "voucher-checkout" : "booking-checkout";
      const payloadKey = stayMode === "voucher" ? "voucher_id" : "booking_id";
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: { [payloadKey]: bookingId, payment_method: payMethod },
      });
      if (error || data?.error) {
        throw new Error(await fnErrorMessage(error, data, "Payment failed"));
      }
      if (data?.checkout_url) {
        window.location.href = data.checkout_url as string;
        return;
      }
      // If we don't have voucher checkout yet, just simulate success for UI progression
      if (stayMode === "voucher" && !data?.checkout_url) {
        setStep("done");
        return;
      }
      throw new Error("Payment provider did not return a checkout URL");
    } catch (err) {
      toast({ title: "Payment error", description: (err as Error).message, variant: "destructive" });
      // Temporary fallback for unimplemented voucher-checkout
      if (stayMode === "voucher" && (err as Error).message.includes("Function not found")) {
        setStep("done");
      }
    } finally {
      setPaying(false);
    }
  }

  // One-shot guest checkout: book + create/attach account + open payment, no
  // sign-in required. Vouchers and long-term requests still require an account.
  async function guestBook() {
    if (!guestName.trim() || !guestEmail.trim() || !guestAgree) return;
    setGuestSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        listing_id: listing.id,
        guests,
        guest_message: message.trim() || undefined,
        payment_method: payMethod,
        contact: {
          full_name: guestName.trim(),
          email: guestEmail.trim(),
          phone: guestPhone.trim() || undefined,
        },
      };
      if (stayMode === "overnight") {
        payload.check_in = format(range!.from!, "yyyy-MM-dd");
        payload.check_out = format(range!.to!, "yyyy-MM-dd");
      } else {
        payload.check_in = format(hourlyDate!, "yyyy-MM-dd");
        payload.check_out = format(addDays(hourlyDate!, 1), "yyyy-MM-dd");
        payload.stay_type = "hourly";
        payload.arrival_time = arrivalTime;
        payload.duration_hours = durationHours;
      }

      const { data, error } = await supabase.functions.invoke("guest-book-listing", {
        body: payload,
      });
      if (error || data?.error) {
        throw new Error(await fnErrorMessage(error, data, "Booking failed"));
      }
      if (data?.checkout_url) {
        window.location.href = data.checkout_url as string;
        return;
      }
      throw new Error("Payment provider did not return a checkout URL");
    } catch (err) {
      toast({ title: "Booking failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGuestSubmitting(false);
    }
  }

  if (step === "pay") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-5">
        <div className="text-center space-y-1">
          <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
          <p className="font-semibold text-lg">Almost there — secure your {stayMode === 'voucher' ? 'voucher' : 'stay'}</p>
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
                    ? "Pay secure now via Card"
                    : id === "gcash"
                    ? "Pay now via GCash e-wallet"
                    : "Pay now via Maya (PayMaya)"}
                </p>
              </div>
            </button>
          ))}
        </div>

        <>
          <Button className="w-full" onClick={pay} disabled={paying}>
            {paying
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : `Pay with ${PAYMENT_METHODS.find((m) => m.id === payMethod)?.label}`}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You will be redirected to complete payment.
          </p>
        </>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
        <p className="font-semibold text-lg">
          {stayMode === "voucher" ? "Voucher purchased!" : isShortTermStay ? "Booking confirmed!" : "Long-term request sent"}
        </p>
        <p className="text-sm text-muted-foreground">
          {stayMode === "voucher" 
            ? "Your open-date voucher is active."
            : isShortTermStay
            ? "You're booked. Check your email for details."
            : "The host has 24 hours to respond. You'll be notified as soon as they decide."}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button asChild>
            <Link to="/my-bookings">{stayMode === 'voucher' ? 'View your vouchers' : 'View your bookings'}</Link>
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
            {listing.promo_price ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">₱{listing.promo_price.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground line-through">₱{listing.nightly_php.toLocaleString()}</span>
              </div>
            ) : (
              <span className="text-2xl font-bold">₱{listing.nightly_php.toLocaleString()}</span>
            )}
            <span className="text-sm text-muted-foreground">
              {stayMode === "overnight" ? " / night" : " / base rate"}
            </span>
          </div>
          {isShortTermStay && listing.booking_mode !== "voucher" && (
            <span className="flex items-center gap-1 text-xs text-primary font-medium">
              <Zap className="h-3.5 w-3.5" /> Instant book
            </span>
          )}
        </div>

        {listing.stay_availability_type === "both" && listing.booking_mode !== "voucher" && (
          <Tabs value={stayMode} onValueChange={(v) => setStayMode(v as "overnight" | "hourly" | "voucher")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overnight">Overnight</TabsTrigger>
              <TabsTrigger value="hourly">Hourly</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {stayMode === "overnight" && (
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
        )}

        {stayMode === "hourly" && (
          <div className="space-y-3">
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-sm text-left hover:border-primary/40 transition-colors">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  {hourlyDate ? (
                    <span>{format(hourlyDate, "MMM d, yyyy")}</span>
                  ) : (
                    <span className="text-muted-foreground">Select date</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={hourlyDate}
                  onSelect={(d) => {
                    setHourlyDate(d);
                    if (d) setCalOpen(false);
                  }}
                  disabled={(date) =>
                    date < addDays(new Date(), 0) || isDateBooked(date)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="grid grid-cols-2 gap-2">
              <Select value={hourlyBlock} onValueChange={(v) => setHourlyBlock(v as "base" | "3h" | "6h" | "12h")}>
                <SelectTrigger>
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base hour</SelectItem>
                  {listing.price_3h && <SelectItem value="3h">3 hours</SelectItem>}
                  {listing.price_6h && <SelectItem value="6h">6 hours</SelectItem>}
                  {listing.price_12h && <SelectItem value="12h">12 hours</SelectItem>}
                </SelectContent>
              </Select>
              
              <Select value={arrivalTime} onValueChange={setArrivalTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Arrival" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, i) => {
                    const booked = arrivalOverlaps(i);
                    const past = arrivalInPast(i);
                    const label = `${i.toString().padStart(2, '0')}:00`;
                    return (
                      <SelectItem key={i} value={label} disabled={booked || past}>
                        {label}{booked ? " · booked" : past ? " · past" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {stayMode === "voucher" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              Buy an open-date voucher to use later.
            </div>
            <Select value={hourlyBlock} onValueChange={(v) => setHourlyBlock(v as "base" | "3h" | "6h" | "12h")}>
              <SelectTrigger>
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base hourly</SelectItem>
                {listing.price_3h && <SelectItem value="3h">3-hour block</SelectItem>}
                {listing.price_6h && <SelectItem value="6h">6-hour block</SelectItem>}
                {listing.price_12h && <SelectItem value="12h">12-hour block</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        )}

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
        {stayMode === "overnight" && tooShort && (
          <p className="text-xs text-destructive">
            Minimum stay is {listing.min_nights} nights — select at least {listing.min_nights} nights.
          </p>
        )}
        {rangeInvalid && (
          <p className="text-xs text-destructive">
            {stayMode === "hourly" 
              ? "That time slot is unavailable — please pick another time or duration."
              : "Those dates include nights that are already booked. Please choose different dates."}
          </p>
        )}
        {stayMode === "overnight" && tooLong && listing.max_nights != null && (
          <p className="text-xs text-destructive">
            Maximum stay is {listing.max_nights} nights — please shorten your dates.
          </p>
        )}
        {stayMode === "overnight" && shortTermBlocked && (
          <p className="text-xs text-destructive">
            This listing does not accept short-term stays (≤30 nights).
          </p>
        )}
        {stayMode === "overnight" && longTermBlocked && (
          <p className="text-xs text-destructive">
            This listing does not accept long-term stays (31+ nights).
          </p>
        )}

        {/* Price breakdown */}
        {(canBook || (stayMode === 'overnight' && nights >= listing.min_nights && !rangeInvalid)) && (
          <div className="space-y-1.5 text-sm border-t border-border/60 pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>{displayTotalText}</span>
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
        {stayMode !== "voucher" && (
          <Textarea
            placeholder="Message to host (optional)"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="text-sm"
          />
        )}

        <Button
          className="w-full"
          disabled={!canBook || submitting}
          onClick={
            user
              ? () => setShowLegalGate(true)
              : guestEligible
                ? () => setShowGuestDialog(true)
                : () => goToAuth()
          }
          aria-label={stayMode === "voucher" ? "Buy Voucher" : isShortTermStay ? "Book now" : "Request to book"}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !user ? (
            guestEligible ? "Book as guest" : "Sign in to book"
          ) : stayMode === "voucher" ? (
            "Buy Voucher"
          ) : stayMode === "hourly" ? (
            "Book Hourly"
          ) : isLongTermStay ? (
            "Request to book"
          ) : (
            "Book now"
          )}
        </Button>

        {!user && guestEligible && (
          <button
            type="button"
            onClick={goToAuth}
            className="w-full text-xs text-center text-muted-foreground underline-offset-2 hover:underline"
          >
            Have an account? Sign in instead
          </button>
        )}

        {canBook && stayMode !== "voucher" && (
          <p className="text-xs text-center text-muted-foreground">
            {isShortTermStay
              ? "You won't be charged yet."
              : "No charge until the host approves your request."}
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
                if (houseRules && stayMode !== "voucher") {
                  setShowHouseRulesGate(true);
                } else {
                  await book();
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {user && houseRules && stayMode !== "voucher" && (
        <Dialog open={showHouseRulesGate} onOpenChange={setShowHouseRulesGate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>House Rules</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2 mb-1">
              Read and accept the host's house rules before booking.
            </p>
            <LegalScrollGate
              userId={user.id}
              role="guest"
              contextId={listing.id}
              documentId="house-rules"
              documentVersion={houseRules.current_version}
              documentHash={houseRules.current_hash}
              checkboxLabel="I have read and agree to the host's house rules."
              legalContent={
                <p className="text-sm whitespace-pre-wrap leading-relaxed font-sans">
                  {houseRules.rules_json.text}
                </p>
              }
              onAccepted={async () => {
                setShowHouseRulesGate(false);
                await book();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {!user && guestEligible && (
        <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book as guest</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              We'll email your booking details and create an account so you can manage it —
              no password required.
            </p>

            <div className="space-y-3 mt-1">
              <div className="space-y-1.5">
                <Label htmlFor="guest-name">Full name</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone">Phone (optional)</Label>
                <Input
                  id="guest-phone"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="09xx xxx xxxx"
                />
              </div>
            </div>

            <div className="space-y-2 mt-1">
              <p className="text-xs font-medium text-muted-foreground">Payment method</p>
              {PAYMENT_METHODS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPayMethod(id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    payMethod === id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-start gap-2 mt-1">
              <Checkbox
                id="guest-agree"
                checked={guestAgree}
                onCheckedChange={(v) => setGuestAgree(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="guest-agree" className="text-xs font-normal leading-relaxed text-muted-foreground">
                I agree to the{" "}
                <Link to="/renter-rules" target="_blank" className="underline">Renter Rules</Link>
                {houseRules ? <> and the host's house rules</> : null} and the{" "}
                <Link to="/refunds" target="_blank" className="underline">cancellation policy</Link>.
              </Label>
            </div>

            <Button
              className="w-full mt-2"
              disabled={!guestName.trim() || !guestEmail.trim() || !guestAgree || guestSubmitting}
              onClick={guestBook}
            >
              {guestSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to payment"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              You'll be redirected to complete payment securely.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
