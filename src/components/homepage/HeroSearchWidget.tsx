import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Calendar, MapPin, Search as SearchIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tab = "condo" | "motel";

const CITY_SUGGESTIONS = [
  "Makati", "BGC", "Ortigas", "Pasay", "Quezon City", "Manila",
  "Mandaluyong", "Taguig", "Alabang", "Paranaque", "San Juan", "Pasig",
];

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Hero search widget rendered inside `<Hero />`.
 *
 * Submits to `/search` with query params that the search page already
 * understands: `q` (auto-runs search), `category` (Condo tab → filters to
 * stay_category=condo), `availability` (Motel tab → filters to hourly stays).
 * `guests`, `check_in`, and `check_out` are also carried; the search page
 * reads `guests` to seed the min-guests filter.
 */
export function HeroSearchWidget() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("condo");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tab === "condo") params.set("category", "condo");
    else params.set("availability", "hourly");
    const q = city.trim();
    if (q) params.set("q", q);
    if (checkIn) params.set("check_in", checkIn);
    if (checkOut) params.set("check_out", checkOut);
    if (guests > 1) params.set("guests", String(guests));
    navigate(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-3xl border border-border/60 bg-card/95 shadow-[0_30px_80px_-30px_hsl(30_20%_10%/0.35)] backdrop-blur-sm overflow-hidden"
    >
      {/* Tabs */}
      <div role="tablist" aria-label="Stay type" className="flex gap-1 px-4 pt-4 border-b border-border/40">
        <TabButton active={tab === "condo"} onClick={() => setTab("condo")} icon={Building2} label="Condo Stays" />
        <TabButton active={tab === "motel"} onClick={() => setTab("motel")} icon={Calendar} label="Short Stays / Motels" />
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_0.9fr_auto] gap-0 divide-y md:divide-y-0 md:divide-x divide-border/40">
        <Field icon={MapPin} label="Where to?">
          <input
            type="text"
            list="cheapstays-hero-city-suggestions"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Makati, BGC, Ortigas"
            className="w-full bg-transparent text-sm md:text-base outline-none placeholder:text-muted-foreground/70"
            aria-label="Where to?"
          />
          <datalist id="cheapstays-hero-city-suggestions">
            {CITY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field icon={Calendar} label="Check-in">
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full bg-transparent text-sm md:text-base outline-none text-foreground [color-scheme:light] dark:[color-scheme:dark]"
            aria-label="Check-in date"
          />
        </Field>

        <Field icon={Calendar} label="Check-out">
          <input
            type="date"
            value={checkOut}
            min={checkIn || today}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-transparent text-sm md:text-base outline-none text-foreground [color-scheme:light] dark:[color-scheme:dark]"
            aria-label="Check-out date"
          />
        </Field>

        <Field icon={Users} label="Guests">
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full bg-transparent text-sm md:text-base outline-none appearance-none"
            aria-label="Guests"
          >
            {GUEST_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "Guest" : "Guests"}</option>
            ))}
          </select>
        </Field>

        <div className="p-3 md:p-4 flex items-center justify-end">
          <Button type="submit" size="lg" className="w-full md:w-auto h-12 px-6 rounded-2xl bg-foreground text-background hover:bg-foreground/90">
            <SearchIcon className="h-4 w-4 mr-2" /> Search
          </Button>
        </div>
      </div>
    </form>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Building2;
  label: string;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="group flex items-center gap-3 px-4 py-3 md:py-4 cursor-text hover:bg-muted/30 transition-colors">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
      <span className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80 font-medium">{label}</span>
        {children}
      </span>
    </label>
  );
}
