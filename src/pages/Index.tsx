import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, Compass, MapPin, Quote, ShieldCheck, Sparkles, Star, TrendingDown, Waves, Zap } from "lucide-react";
import { HeroCarousel } from "@/components/HeroCarousel";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import s7 from "@/assets/stay-7.jpg";

const features = [
  { icon: Sparkles, title: "AI deal hunter", body: "Describe your trip in Tagalog or English. Pip scores every PH listing on real value, not vibes." },
  { icon: TrendingDown, title: "Owner-direct prices", body: "We surface hosts priced below Airbnb & Agoda averages — no resale markup, no junk fees." },
  { icon: ShieldCheck, title: "Transparent fees", body: "Every total in pesos, broken down. Cleaning, env fee, taxes — all visible before you tap book." },
  { icon: Zap, title: "Instant peso alerts", body: "Save a search. We ping you the moment a Palawan stay drops below your number." },
];

const destinations = [
  { img: s1, name: "El Nido, Palawan", tagline: "Limestone lagoons", from: "₱2,400" },
  { img: s2, name: "Siargao", tagline: "Surf & coconut groves", from: "₱1,650" },
  { img: s6, name: "Boracay", tagline: "Powder-white sand", from: "₱3,100" },
  { img: s4, name: "Batanes", tagline: "Stone huts & green hills", from: "₱2,200" },
  { img: s3, name: "Bohol", tagline: "Chocolate Hills views", from: "₱2,900" },
  { img: s7, name: "Baguio", tagline: "Cool pine highlands", from: "₱1,950" },
  { img: s5, name: "Vigan", tagline: "Heritage Spanish casas", from: "₱1,500" },
];

const steps = [
  { n: "01", title: "Tell Pip what you want", body: "Type or speak: budget, dates, vibe. Pip understands Filipino-English mix." },
  { n: "02", title: "AI hunts owner-direct", body: "We scan public listings and verified hosts across 80+ Philippine destinations." },
  { n: "03", title: "Book with full transparency", body: "See every peso. Message the host. Lock the deal — no platform markup." },
];

const stats = [
  { v: "₱18M+", l: "saved by members in 2025" },
  { v: "12,400", l: "verified PH listings" },
  { v: "82", l: "islands covered" },
  { v: "4.9★", l: "member rating" },
];

const testimonials = [
  { name: "Mika R.", city: "Quezon City", body: "Found a Coron beachfront for ₱2,800/night that was ₱5,200 on Airbnb. Same exact unit. I'm never going back." },
  { name: "JP de Leon", city: "Makati", body: "Pip planned our whole Siargao week in five messages. Surf lessons, transfers, and a hut under our budget." },
  { name: "Andrea S.", city: "Cebu", body: "Booked a Batanes stone house through a host I'd never have found. Felt like a local secret." },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function Index() {
  return (
    <div>
      <section className="container pt-14 pb-20 md:pt-20 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease }}
          >
            <Badge variant="secondary" className="mb-6">AI-powered · zero markup</Badge>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.02]">
              Find it cheap.<br />
              <span className="text-primary">Stay smart.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              AI-powered short-term rental deals. Owner-direct prices. Zero markup guilt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="group">
                <Link to="/search">
                  Start hunting
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/membership">See membership</Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live deal scanner</span>
              <span>·</span>
              <span>7 stays cycling now</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.15, ease }}
          >
            <HeroCarousel />
          </motion.div>
        </div>
      </section>
      <section className="container pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: idx * 0.07, ease }}
            >
              <Card className="p-6 bg-card/90 border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-30px_hsl(150_30%_10%/0.35)]">
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="container py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.l}>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">{s.v}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Destinations */}
      <section className="container py-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3"><Compass className="h-3 w-3 mr-1" /> Destinations</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">From Palawan to Batanes.</h2>
            <p className="mt-3 text-muted-foreground">Seven thousand islands. Hand-picked stays in the ones you actually want to visit.</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/search">Browse all <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((d, idx) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: idx * 0.05, ease }}
              className={`group relative overflow-hidden rounded-2xl ring-1 ring-border/60 ${idx === 0 ? "sm:col-span-2 sm:row-span-2 aspect-[4/5] sm:aspect-auto" : "aspect-[4/5]"}`}
            >
              <img
                src={d.img}
                alt={`${d.name} — ${d.tagline}`}
                loading="lazy"
                width={1024}
                height={1280}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-background">
                <p className="text-xs uppercase tracking-[0.18em] opacity-70 flex items-center gap-1"><MapPin className="h-3 w-3" /> Philippines</p>
                <p className="mt-1 text-xl font-medium">{d.name}</p>
                <div className="flex items-end justify-between mt-1">
                  <p className="text-sm opacity-80">{d.tagline}</p>
                  <p className="text-sm font-medium">from {d.from}<span className="opacity-70 text-xs">/night</span></p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card/60 border-y border-border/60">
        <div className="container py-24 grid lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
          <div>
            <Badge variant="secondary" className="mb-3"><Waves className="h-3 w-3 mr-1" /> How it works</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">A smarter way to book PH stays.</h2>
            <p className="mt-4 text-muted-foreground max-w-md">No bidding wars. No mystery fees. Just one AI that knows the islands and an honest list of homes that fit your budget.</p>
            <Button className="mt-6" asChild>
              <Link to="/search">Try Pip <Sparkles className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="space-y-3">
            {steps.map((s, idx) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.08, ease }}
              >
                <Card className="p-6 flex gap-5 items-start border-border/60">
                  <span className="text-3xl font-semibold text-primary/70 tabular-nums">{s.n}</span>
                  <div>
                    <h3 className="font-medium">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container py-24">
        <div className="max-w-xl mb-10">
          <Badge variant="secondary" className="mb-3"><Star className="h-3 w-3 mr-1" /> Loved by Filipino travelers</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Members save thousands of pesos.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.07, ease }}
            >
              <Card className="p-6 h-full border-border/60 bg-card/90">
                <Quote className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm leading-relaxed">{t.body}</p>
                <p className="mt-4 text-xs text-muted-foreground">{t.name} · {t.city}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-10 md:p-16">
          <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Your next PH stay is cheaper than you think.</h2>
            <p className="mt-4 opacity-85">Join CheapStays and let Pip do the hunting. Cancel anytime.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/membership">Become a member</Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/search">Start a free search <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
