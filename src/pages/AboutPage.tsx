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
import metroAerial from "@/assets/city-cebu.jpg";

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

const METRO_PINS: { name: string }[] = [
  { name: "Quezon City" },
  { name: "Makati" },
  { name: "Pasig" },
  { name: "Mandaluyong" },
  { name: "Taguig" },
  { name: "Parañaque" },
];

export default function AboutPage() {
  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title="About Us · CheapStays"
        description="CheapStays is a Philippine short-term rental marketplace built on fair, owner-direct pricing. Quality condos and short stays across Metro Manila."
        path="/about"
      />

      {/* Hero — below md the copy overlays the photo; md+ splits into the
          left-copy / right-photo layout from the mock. */}
      <section className="relative isolate">
        <div className="relative md:grid md:grid-cols-[1.05fr_1.2fr] md:min-h-[68dvh] lg:min-h-[72dvh]">
          {/* Photo layer — full-bleed background below md, right column at md+ */}
          <div className="absolute inset-0 -z-10 overflow-hidden md:static md:z-0 md:col-start-2 md:row-start-1">
            <img
              src={heroInterior}
              alt="Bright condo living room with a Metro Manila skyline view through floor-to-ceiling windows"
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Scrim: dark for overlay legibility below md, warm gradient at md+ */}
            <div
              aria-hidden
              className="absolute inset-0 bg-foreground/55 md:bg-gradient-to-r md:from-background md:via-background/50 md:to-transparent"
            />
          </div>

          {/* Copy layer — centered over photo below md, left column at md+ */}
          <div className="relative z-10 md:col-start-1 md:row-start-1 flex flex-col justify-center items-center md:items-start text-center md:text-left px-6 sm:px-10 lg:px-16 py-20 md:py-20 lg:py-24 min-h-[92dvh] md:min-h-0 mx-auto md:mx-0 w-full max-w-[560px] md:max-w-[640px] lg:max-w-[720px]">
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
              className="mt-4 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white md:text-foreground leading-[1.05]"
            >
              Better stays.<br />
              Better <span className="text-primary">value.</span>
            </motion.h1>

            <motion.span
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.24, ease }}
              className="mt-5 block h-[3px] w-16 bg-primary origin-center md:origin-left rounded-full"
              aria-hidden
            />

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease }}
              className="mt-6 max-w-md text-base text-white/85 md:text-muted-foreground"
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
              className="mt-10 flex items-start justify-center md:justify-start gap-6 md:gap-8"
            >
              {STAY_TYPES.map(({ icon: Icon, label }, i) => (
                <motion.li
                  key={label}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
                  }}
                  className={`flex flex-col items-center md:items-start gap-2 min-w-0 ${
                    i > 0 ? "pl-6 md:pl-8 border-l border-white/30 md:border-border/50" : ""
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 ring-1 ring-white/20 md:bg-accent/60 md:ring-border/60">
                    <Icon className="h-5 w-5 text-white md:text-foreground/80" aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-white md:text-foreground whitespace-nowrap">
                    {label}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {/* Floating credibility pill — bottom-center over the photo below md, bottom-right at md+ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.36, ease }}
            className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 max-w-[260px] rounded-2xl bg-card border border-border/60 px-4 py-3 shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.45)] flex items-center gap-3"
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
      </section>

      {/* Mission + Vision */}
      <section className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease }}
          className="rounded-3xl bg-card border border-border/60 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50 overflow-hidden"
        >
          <div className="p-6 md:p-8 flex items-center">
            <MissionColumn
              icon={Target}
              eyebrow="Our Mission"
              body="To make quality stays more affordable and accessible, so guests can stay comfortably without spending more than they need."
            />
          </div>
          <div className="p-6 md:p-8 flex items-center">
            <div className="w-full">
              <MissionColumn
                icon={Eye}
                eyebrow="Our Vision"
                body="To become the easiest and most trusted way to find and book affordable stays in the Philippines."
              />
              <div className="mt-4 pl-16 space-y-0.5">
                <p className="text-base md:text-lg font-semibold tracking-tight text-foreground">
                  Simple stays. Easy booking.
                </p>
                <p className="text-base md:text-lg font-semibold tracking-tight text-foreground">
                  As easy as{" "}
                  <span className="text-primary">1</span>,{" "}
                  <span className="text-primary">2</span>,{" "}
                  <span className="text-primary">3</span>.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Why CheapStays */}
      <section className="container py-12 md:py-16">
        <h2 className="text-center text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-10">
          Why CheapStays?
        </h2>
        <div className="grid md:grid-cols-3 max-w-5xl mx-auto divide-y md:divide-y-0 md:divide-x divide-border/50">
          {WHY.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease }}
              className="flex items-start gap-4 px-4 md:px-8 py-6 md:py-4"
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
      <section className="container py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] items-center">
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
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
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
                <Building2 className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <span>
                <span className="font-semibold text-foreground">6 cities</span> and counting
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card min-h-[280px] md:min-h-[340px]">
            <img
              src={metroAerial}
              alt="Aerial view of Metro Manila with high-rise condominiums and a dense urban skyline"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Warm scrim so the pin chips stay readable over any photo tone */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent"
            />
            {/* City coverage chips — anchored at the bottom of the photo,
                reads as "areas we cover" without pretending to be a real map. */}
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                {METRO_PINS.map((p) => (
                  <span
                    key={p.name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-card/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border/60"
                  >
                    <MapPin className="h-3 w-3 text-primary" fill="currentColor" aria-hidden />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
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
            <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center items-center md:items-start text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Your next stay starts here.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Comfortable. Convenient. Affordable.
              </p>
              <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
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

