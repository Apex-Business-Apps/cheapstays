import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, Compass, MapPin, Quote, Star, Waves } from "lucide-react";
import { HeroCarousel } from "@/components/HeroCarousel";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import s7 from "@/assets/stay-7.jpg";
import cityCebu from "@/assets/city-cebu.jpg";
import cityDavao from "@/assets/city-davao.jpg";
import cityTagaytay from "@/assets/city-tagaytay.jpg";
import cityLaUnion from "@/assets/city-launion.jpg";
import cityDumaguete from "@/assets/city-dumaguete.jpg";
import cityCoron from "@/assets/city-coron.jpg";
import cityIloilo from "@/assets/city-iloilo.jpg";
import cityCamiguin from "@/assets/city-camiguin.jpg";
import iconAiHunt from "@/assets/icon-ai-hunt.png";
import iconOwnerDirect from "@/assets/icon-owner-direct.png";
import iconVerified from "@/assets/icon-verified-hosts.png";
import iconPay from "@/assets/icon-flexible-pay.png";
import iconConcierge from "@/assets/icon-concierge.png";
import iconBook from "@/assets/icon-instant-book.png";
import emblemBeach from "@/assets/emblem-beach.png";
import emblemMountain from "@/assets/emblem-mountain.png";
import emblemHeritage from "@/assets/emblem-heritage.png";
import emblemUrban from "@/assets/emblem-urban.png";
import brandMark from "@/assets/brand-mark.png";
import { Seo } from "@/components/Seo";

const features = [
  { icon: iconAiHunt, title: "AI deal hunter", body: "Describe your trip in Tagalog or English. Pip scores every PH listing on real value, not vibes." },
  { icon: iconOwnerDirect, title: "Owner-direct prices", body: "We surface hosts priced below Airbnb & Agoda averages — no resale markup, no junk fees." },
  { icon: iconVerified, title: "Verified Filipino hosts", body: "Every host is ID-checked, with reviews from real members. No ghost listings, no surprises." },
  { icon: iconPay, title: "GCash, Maya & card", body: "Pay any way you like. Split with barkada via shared wallets. Refunds back to source in 24h." },
  { icon: iconConcierge, title: "24/7 Pip concierge", body: "Lost your booking code at 2am in Coron? Pip answers in seconds — voice or text, Tagalog or English." },
  { icon: iconBook, title: "Instant confirmation", body: "No 'awaiting host' limbo. Booking is live the moment your peso clears. Keys on your phone." },
];

const destinations = [
  { img: s1, name: "El Nido, Palawan", tagline: "Limestone lagoons", from: "₱2,400", emblem: emblemBeach },
  { img: s2, name: "Siargao", tagline: "Surf & coconut groves", from: "₱1,650", emblem: emblemBeach },
  { img: s6, name: "Boracay", tagline: "Powder-white sand", from: "₱3,100", emblem: emblemBeach },
  { img: s4, name: "Batanes", tagline: "Stone huts & green hills", from: "₱2,200", emblem: emblemMountain },
  { img: s3, name: "Bohol", tagline: "Chocolate Hills views", from: "₱2,900", emblem: emblemMountain },
  { img: s7, name: "Baguio", tagline: "Cool pine highlands", from: "₱1,950", emblem: emblemMountain },
  { img: s5, name: "Vigan", tagline: "Heritage Spanish casas", from: "₱1,500", emblem: emblemHeritage },
];

const cityStaycations = [
  { img: cityCebu, name: "Cebu City", tagline: "Skyline + sea condos", from: "₱2,100", nights: "3 nights avg", emblem: emblemUrban, kind: "Urban" },
  { img: cityDavao, name: "Davao", tagline: "Durian groves, Mt. Apo", from: "₱1,800", nights: "Quiet retreats", emblem: emblemMountain, kind: "Nature" },
  { img: cityTagaytay, name: "Tagaytay", tagline: "Taal volcano cabins", from: "₱2,650", nights: "Weekend favorite", emblem: emblemMountain, kind: "Highlands" },
  { img: cityLaUnion, name: "La Union", tagline: "Surf shacks & hammocks", from: "₱1,400", nights: "Surf town vibes", emblem: emblemBeach, kind: "Beach" },
  { img: cityDumaguete, name: "Dumaguete", tagline: "Acacia-lined boulevard", from: "₱1,650", nights: "Slow living", emblem: emblemHeritage, kind: "Heritage" },
  { img: cityCoron, name: "Coron, Palawan", tagline: "Overwater bamboo bungalows", from: "₱3,400", nights: "Bucket-list", emblem: emblemBeach, kind: "Island" },
  { img: cityIloilo, name: "Iloilo", tagline: "Capiz-window casas", from: "₱1,750", nights: "Foodie haven", emblem: emblemHeritage, kind: "Heritage" },
  { img: cityCamiguin, name: "Camiguin", tagline: "Volcano cove cottages", from: "₱2,250", nights: "Island escape", emblem: emblemBeach, kind: "Island" },
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
      <Seo title="CheapStays" description="AI-powered Philippine short-term rentals with owner-direct pricing and zero markup." path="/" />
    <div>
      <section className="container pt-14 pb-20 md:pt-20 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-start">
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
      {/* Why CheapStays — hand-painted feature icons */}
      <section className="container pb-24">
        <div className="max-w-2xl mb-12">
          <Badge variant="secondary" className="mb-3">Why CheapStays</Badge>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Six reasons your <span className="text-accent">titos and titas</span> will copy your trip.
          </h2>
          <p className="mt-4 text-muted-foreground">Every icon hand-painted. Every feature built around how Filipinos actually book.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: idx * 0.06, ease }}
            >
              <Card className="group relative overflow-hidden p-7 h-full bg-card/95 border-border/60 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_80px_-40px_hsl(150_30%_10%/0.45)]">
                <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-accent/5 blur-2xl transition-opacity duration-500 group-hover:bg-accent/15" />
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center overflow-hidden transition-transform duration-500 group-hover:scale-[1.06] group-hover:rotate-[-3deg]">
                    <img src={f.icon} alt="" width={64} height={64} loading="lazy" className="h-14 w-14 object-contain" />
                  </div>
                  <h3 className="mt-5 text-lg font-medium tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
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
              <img
                src={d.emblem}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                className="absolute top-4 right-4 h-12 w-12 rounded-full bg-background/85 backdrop-blur p-1 ring-1 ring-border/60 shadow-lg transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-110"
              />
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

      {/* City Staycations — 8 new picks */}
      <section className="relative overflow-hidden border-y border-border/60 bg-gradient-to-b from-secondary/30 via-background to-background">
        <div className="absolute top-12 right-[-60px] h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="container py-24">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <div className="max-w-xl">
              <Badge variant="secondary" className="mb-3">
                <img src={brandMark} alt="" width={16} height={16} className="h-4 w-4 mr-1.5" />
                City staycations
              </Badge>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                Eight new cities. <span className="text-accent">One long weekend</span> away.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-md">From a Cebu skyline balcony to a Camiguin volcano cove — fresh PH picks Pip hand-curated this week.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/search">See all city stays <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cityStaycations.map((c, idx) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: idx * 0.05, ease }}
              >
                <Card className="group relative overflow-hidden border-border/60 bg-card/95 p-0 h-full transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_80px_-40px_hsl(150_30%_10%/0.5)]">
                  <div className="relative aspect-[5/4] overflow-hidden">
                    <img
                      src={c.img}
                      alt={`${c.name} — ${c.tagline}`}
                      loading="lazy"
                      width={1280}
                      height={1024}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.08]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />
                    <img
                      src={c.emblem}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="absolute top-3 left-3 h-14 w-14 rounded-full bg-background/90 backdrop-blur p-1 ring-1 ring-border/60 shadow-md transition-transform duration-500 group-hover:rotate-[-10deg] group-hover:scale-110"
                    />
                    <span className="absolute top-4 right-4 text-[10px] uppercase tracking-[0.18em] bg-background/85 backdrop-blur text-foreground px-2.5 py-1 rounded-full ring-1 ring-border/60">
                      {c.kind}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.nights}</p>
                        <h3 className="mt-1.5 text-lg font-medium tracking-tight">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">{c.tagline}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">from</p>
                        <p className="text-base font-semibold text-primary">{c.from}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
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
              <Link to="/search">Try Pip <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
    </div>
  );
}