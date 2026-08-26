import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bed,
  BadgePercent,
  Building2,
  CalendarClock,
  CalendarCheck2,
  Eye,
  Home,
  MapPin,
  Target,
  Wallet,
  ShieldCheck,
  User,
} from "lucide-react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import heroInterior from "@/assets/stay-2.jpg";
import guestInterior from "@/assets/stay-6.jpg";
import ownerBuilding from "@/assets/city-tagaytay.jpg";
import ctaSkyline from "@/assets/city-cebu.jpg";

const ease = [0.22, 1, 0.36, 1] as const;

const STAY_TYPES = [
  { icon: Building2,     label: "Condos" },
  { icon: Bed,           label: "Motels" },
  { icon: CalendarClock, label: "Short-term stays" },
];

const WHY = [
  {
    icon: Wallet,
    title: "Affordable",
    body: "More choices at prices that make sense.",
  },
  {
    icon: ShieldCheck,
    title: "Quality Stays",
    body: "Comfortable properties you can feel good about booking.",
  },
  {
    icon: CalendarCheck2,
    title: "More Flexible",
    body: "From overnight stays to longer trips, find a stay that fits your plans.",
  },
];

const METRO_PINS: { name: string; x: number; y: number }[] = [
  { name: "Quezon City",  x: 58, y: 22 },
  { name: "Makati",       x: 42, y: 52 },
  { name: "Pasig",        x: 68, y: 50 },
  { name: "Mandaluyong",  x: 50, y: 62 },
  { name: "Taguig",       x: 72, y: 68 },
  { name: "Parañaque",    x: 40, y: 78 },
];

export default function AboutPage() {
  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title="About Us · CheapStays"
        description="CheapStays is a Philippine short-term rental marketplace built on fair, owner-direct pricing. Quality condos and short stays across Metro Manila."
        path="/about"
      />

      {/* Hero */}
      <section className="relative isolate">
        <div className="relative grid lg:grid-cols-[1.05fr_1.2fr] lg:min-h-[72dvh]">
          <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-14 lg:py-24 max-w-[720px]">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary"
            >
              About CheapStays
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.06, ease }}
              className="mt-4 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]"
            >
              Better stays.<br />
              Better <span className="text-primary">value.</span>
            </motion.h1>

            <motion.span
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.24, ease }}
              className="mt-5 block h-[3px] w-16 bg-primary origin-left rounded-full"
              aria-hidden
            />

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease }}
              className="mt-6 max-w-md text-base text-muted-foreground"
            >
              We make it easy to find quality places to stay without spending more than you need.
            </motion.p>

            <motion.ul
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.08, delayChildren: 0.28 } },
              }}
              className="mt-10 flex items-start gap-8"
            >
              {STAY_TYPES.map(({ icon: Icon, label }, i) => (
                <motion.li
                  key={label}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
                  }}
                  className={`flex flex-col items-start gap-2 min-w-0 ${
                    i > 0 ? "pl-8 border-l border-border/50" : ""
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
                    <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {label}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <div className="relative order-first lg:order-none min-h-[280px] md:min-h-[360px] lg:min-h-0 overflow-hidden">
            <img
              src={heroInterior}
              alt="Bright condo living room with a Metro Manila skyline view through floor-to-ceiling windows"
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent lg:from-background lg:via-background/50 lg:to-transparent"
            />

            {/* Floating credibility pill */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.36, ease }}
              className="absolute bottom-6 right-6 max-w-[260px] rounded-2xl bg-card border border-border/60 px-4 py-3 shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.45)] flex items-center gap-3"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60 shrink-0">
                <BadgePercent className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Quality stays.</p>
                <p className="text-xs text-muted-foreground">Affordable for everyone.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission + Vision */}
      <section className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease }}
          className="rounded-3xl bg-card border border-border/60 grid gap-0 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50 overflow-hidden"
        >
          <div className="p-6 md:p-10">
            <MissionColumn
              icon={Target}
              eyebrow="Our Mission"
              body="To make quality stays more affordable and accessible, so guests can stay comfortably without spending more than they need."
            />
          </div>
          <div className="p-6 md:p-10">
            <MissionColumn
              icon={Eye}
              eyebrow="Our Vision"
              body="To become the easiest and most trusted way to find and book affordable stays in the Philippines."
            />
            <div className="mt-5 pl-16 space-y-0.5">
              <p className="text-lg font-semibold tracking-tight text-foreground">
                Simple stays. Easy booking.
              </p>
              <p className="text-lg font-semibold tracking-tight text-foreground">
                As easy as{" "}
                <span className="text-primary">1</span>,{" "}
                <span className="text-primary">2</span>,{" "}
                <span className="text-primary">3</span>.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Why CheapStays */}
      <section className="container py-12 md:py-16">
        <h2 className="text-center text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-10">
          Why CheapStays?
        </h2>
        <div className="grid gap-8 md:gap-10 md:grid-cols-3 max-w-4xl mx-auto">
          {WHY.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease }}
              className="flex items-start gap-4 justify-self-center max-w-[300px]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
                <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* For Guests / For Property Owners tiles */}
      <section className="container py-8 md:py-10">
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <AudienceTile
            icon={User}
            title="For Guests"
            body="Discover affordable condos, motels, and other stays in one place."
            image={guestInterior}
            alt="Bright hotel room with a made bed and warm bedside lamp overlooking the city"
            to="/types-of-stays"
          />
          <AudienceTile
            icon={Home}
            title="For Property Owners"
            body="Reach more guests while keeping more of what you earn with lower platform fees."
            image={ownerBuilding}
            alt="Contemporary Metro Manila condominium building at golden hour"
            to="/become-a-partner"
          />
        </div>
      </section>

      {/* Where We Are */}
      <section className="container py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.4fr] items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Where We Are
            </p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight">
              Starting in<br />Metro Manila.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground leading-relaxed">
              We're starting close to home, bringing together stays across Metro Manila before
              expanding to more destinations around the Philippines.
            </p>
          </div>

          <div className="relative rounded-3xl bg-card border border-border/60 p-6 md:p-8 min-h-[320px] overflow-hidden">
            {/* Stylised Metro Manila map illustration.
                Not a real map — a decorative pin layout so the section reads
                geographically without pulling in a mapping SDK. */}
            <MetroPinsMap />
          </div>
        </div>
      </section>

      {/* Final CTA band */}
      <section className="container pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
          className="relative overflow-hidden rounded-3xl bg-muted/60 border border-border/60"
        >
          <div className="grid md:grid-cols-[0.85fr_1.15fr] items-stretch">
            <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Your next stay starts here.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Comfortable. Convenient. Affordable.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="sm"
                  className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-5"
                >
                  <Link to="/types-of-stays">Find a Stay</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-foreground/40 text-foreground hover:bg-foreground/5 px-5"
                >
                  <Link to="/become-a-partner">List Your Property</Link>
                </Button>
              </div>
            </div>
            <div className="relative min-h-[200px] md:min-h-full overflow-hidden">
              <img
                src={ctaSkyline}
                alt="Metro Manila skyline of high-rise condos at dusk"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-muted/60 via-transparent to-transparent md:from-muted/40"
              />
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function MissionColumn({
  icon: Icon,
  eyebrow,
  body,
}: {
  icon: typeof Target;
  eyebrow: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
        <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
        <p className="mt-3 text-sm md:text-base text-foreground/85 leading-relaxed max-w-[36ch]">
          {body}
        </p>
      </div>
    </div>
  );
}

function AudienceTile({
  icon: Icon,
  title,
  body,
  image,
  alt,
  to,
}: {
  icon: typeof User;
  title: string;
  body: string;
  image: string;
  alt: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card"
    >
      <div className="grid grid-cols-[1fr_1fr]">
        <div className="relative p-6 md:p-7 flex flex-col justify-between min-h-[240px]">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-card ring-1 ring-border/70 shadow-sm">
            <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
          </span>
          <div>
            <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            <span className="mt-2 block h-[3px] w-10 bg-primary rounded-full" aria-hidden />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs leading-relaxed">{body}</p>
          </div>
        </div>
        <div className="relative overflow-hidden">
          <img
            src={image}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </div>
      </div>
    </Link>
  );
}

/**
 * Decorative stylised map of Metro Manila with city name pins. Uses a soft
 * SVG landmass shape so it reads as a map without shipping a mapping SDK
 * or leaking real coordinates.
 */
function MetroPinsMap() {
  return (
    <div className="relative w-full h-[300px] md:h-[360px]">
      {/* Central big city icon */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-card ring-1 ring-border/70 shadow-sm">
          <Building2 className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Metro Manila</p>
          <p className="text-xs text-muted-foreground">and counting...</p>
        </div>
      </div>

      {/* Landmass silhouette */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-muted/50"
        aria-hidden
      >
        <path
          d="M28,18 Q52,10 78,20 Q94,32 90,52 Q88,72 74,84 Q56,94 40,90 Q22,84 14,64 Q8,42 20,28 Z"
          fill="currentColor"
          fillOpacity="0.35"
          stroke="hsl(var(--border))"
          strokeWidth="0.4"
        />
      </svg>

      {/* Pins — brass drop marker + city name label alongside it */}
      {METRO_PINS.map((p) => (
        <div
          key={p.name}
          className="absolute -translate-x-1/2 -translate-y-full flex items-center gap-1.5 pointer-events-none"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          <MapPin className="h-4 w-4 text-primary shrink-0" fill="currentColor" aria-hidden />
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            {p.name}
          </span>
        </div>
      ))}
    </div>
  );
}
