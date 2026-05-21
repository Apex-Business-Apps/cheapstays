import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, Compass, MapPin, Quote, Star, Waves } from "lucide-react";
import { HeroCarousel, HERO_STAYS_COUNT } from "@/components/HeroCarousel";
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

const featureIcons = [iconAiHunt, iconOwnerDirect, iconVerified, iconPay, iconConcierge, iconBook];
const FEATURE_KEYS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const STEP_NUMS = ["01", "02", "03"] as const;

const destinations = [
  { img: s1, name: "El Nido, Palawan",  tagline: "Limestone lagoons",       from: "₱2,400", emblem: emblemBeach },
  { img: s2, name: "Siargao",           tagline: "Surf and coconut groves", from: "₱1,650", emblem: emblemBeach },
  { img: s6, name: "Boracay",           tagline: "Powder-white sand",       from: "₱3,100", emblem: emblemBeach },
  { img: s4, name: "Batanes",           tagline: "Stone huts, green hills", from: "₱2,200", emblem: emblemMountain },
  { img: s3, name: "Bohol",             tagline: "Chocolate Hills views",   from: "₱2,900", emblem: emblemMountain },
  { img: s7, name: "Baguio",            tagline: "Cool pine highlands",     from: "₱1,950", emblem: emblemMountain },
  { img: s5, name: "Vigan",             tagline: "Heritage Spanish casas",  from: "₱1,500", emblem: emblemHeritage },
];

const cityStaycations = [
  { img: cityCebu,     name: "Cebu City",    tagline: "Skyline and sea condos",        from: "₱2,100", nights: "3 nights avg",    emblem: emblemUrban,    kind: "Urban" },
  { img: cityDavao,    name: "Davao",        tagline: "Durian groves, Mt. Apo",        from: "₱1,800", nights: "Quiet retreats",  emblem: emblemMountain, kind: "Nature" },
  { img: cityTagaytay, name: "Tagaytay",     tagline: "Taal volcano cabins",           from: "₱2,650", nights: "Weekend pick",    emblem: emblemMountain, kind: "Highlands" },
  { img: cityLaUnion,  name: "La Union",     tagline: "Surf shacks and hammocks",      from: "₱1,400", nights: "Surf town vibes", emblem: emblemBeach,    kind: "Beach" },
  { img: cityDumaguete,name: "Dumaguete",    tagline: "Acacia-lined boulevard",        from: "₱1,650", nights: "Slow living",     emblem: emblemHeritage, kind: "Heritage" },
  { img: cityCoron,    name: "Coron, Palawan",tagline: "Overwater bamboo bungalows",   from: "₱3,400", nights: "Bucket-list",     emblem: emblemBeach,    kind: "Island" },
  { img: cityIloilo,   name: "Iloilo",       tagline: "Capiz-window casas",            from: "₱1,750", nights: "Foodie haven",    emblem: emblemHeritage, kind: "Heritage" },
  { img: cityCamiguin, name: "Camiguin",     tagline: "Volcano cove cottages",         from: "₱2,250", nights: "Island escape",   emblem: emblemBeach,    kind: "Island" },
];

const stats = [
  { v: "₱18M+",  key: "s1Label" },
  { v: "12,400", key: "s2Label" },
  { v: "82",     key: "s3Label" },
  { v: "4.9★",   key: "s4Label" },
];

const testimonials = [
  { name: "Mika R.",    city: "Quezon City", body: "Found a Coron beachfront for ₱2,800/night that was ₱5,200 on Airbnb. Same exact unit. Never going back." },
  { name: "JP de Leon", city: "Makati",      body: "Pip sorted our whole Siargao week in five messages. Surf lessons, transfers, and a hut under budget." },
  { name: "Andrea S.", city: "Cebu",         body: "Booked a Batanes stone house through a host I'd never have found on my own. Felt like a local secret." },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function Index() {
  const { t } = useTranslation();

  return (
    <div>
      <Seo
        title="CheapStays"
        description="Short-term rentals across the Philippines with owner-direct pricing and no platform markup."
        path="/"
      />
      <div>
        {/* HERO */}
        <section className="container pt-14 pb-20 md:pt-20 md:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-start">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
            >
              <Badge variant="secondary" className="mb-6 uppercase tracking-wider text-xs">
                {t("hero.badge")}
              </Badge>
              <h1 className="text-5xl md:text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.02]">
                {t("hero.h1Line1")}<br />
                <span className="text-primary">{t("hero.h1Line2")}</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                {t("hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild className="group">
                  <Link to="/search">
                    {t("hero.ctaHunt")}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/membership">{t("hero.ctaMembership")}</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  {t("hero.liveScanner")}
                </span>
                <span aria-hidden>·</span>
                <span>{t("hero.cycling", { count: HERO_STAYS_COUNT })}</span>
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

        {/* WHY CHEAPSTAYS */}
        <section className="container pb-24">
          <div className="max-w-2xl mb-12">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              {t("why.badge")}
            </Badge>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              {t("why.h2Start")}
              <span className="text-accent">{t("why.h2Accent")}</span>
              {t("why.h2End")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("why.subtitle")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featureIcons.map((icon, idx) => {
              const k = FEATURE_KEYS[idx];
              return (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, delay: idx * 0.06, ease }}
                >
                  <Card className="group relative overflow-hidden p-7 h-full bg-card/95 border-border/60 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_80px_-40px_hsl(150_30%_10%/0.45)]">
                    <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-accent/5 blur-2xl transition-opacity duration-500 group-hover:bg-accent/15" />
                    <div className="relative">
                      <div className="h-16 w-16 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center overflow-hidden transition-transform duration-500 group-hover:scale-[1.06] group-hover:rotate-[-3deg]">
                        <img src={icon} alt="" width={64} height={64} loading="lazy" className="h-14 w-14 object-contain" />
                      </div>
                      <h3 className="mt-5 text-lg font-medium tracking-tight">{t(`why.${k}Title`)}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(`why.${k}Body`)}</p>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* STATS STRIP */}
        <section className="border-y border-border/60 bg-secondary/40">
          <div className="container py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.key}>
                <p className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">{s.v}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">{t(`stats.${s.key}`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DESTINATIONS */}
        <section className="container py-24">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div className="max-w-xl">
              <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
                <Compass className="h-3 w-3 mr-1" /> {t("destinations.badge")}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("destinations.h2")}</h2>
              <p className="mt-3 text-muted-foreground">{t("destinations.subtitle")}</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/search">{t("destinations.browseAll")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
                  <p className="text-xs uppercase tracking-[0.18em] opacity-70 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {t("destinations.philippines")}
                  </p>
                  <p className="mt-1 text-xl font-medium">{d.name}</p>
                  <div className="flex items-end justify-between mt-1">
                    <p className="text-sm opacity-80">{d.tagline}</p>
                    <p className="text-sm font-medium">
                      {t("destinations.from")} {d.from}<span className="opacity-70 text-xs">{t("destinations.perNight")}</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CITY STAYCATIONS */}
        <section className="relative overflow-hidden border-y border-border/60 bg-gradient-to-b from-secondary/30 via-background to-background">
          <div className="absolute top-12 right-[-60px] h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="container py-24">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
              <div className="max-w-xl">
                <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
                  <img src={brandMark} alt="" width={16} height={16} className="h-4 w-4 mr-1.5" />
                  {t("city.badge")}
                </Badge>
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                  {t("city.h2Part1")} <span className="text-accent">{t("city.h2Accent")}</span> {t("city.h2End")}
                </h2>
                <p className="mt-4 text-muted-foreground max-w-md">{t("city.subtitle")}</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/search">{t("city.seeAll")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.nights}
                          </p>
                          <h3 className="mt-1.5 text-lg font-medium tracking-tight">{c.name}</h3>
                          <p className="text-sm text-muted-foreground">{c.tagline}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{t("city.from")}</p>
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

        {/* HOW IT WORKS */}
        <section className="bg-card/60 border-y border-border/60">
          <div className="container py-24 grid lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
            <div>
              <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
                <Waves className="h-3 w-3 mr-1" /> {t("how.badge")}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("how.h2")}</h2>
              <p className="mt-4 text-muted-foreground max-w-md">{t("how.subtitle")}</p>
              <Button className="mt-6" asChild>
                <Link to="/search">{t("how.cta")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="space-y-3">
              {STEP_NUMS.map((n, idx) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.08, ease }}
                >
                  <Card className="p-6 flex gap-5 items-start border-border/60">
                    <span className="text-3xl font-semibold text-primary/70 tabular-nums">{n}</span>
                    <div>
                      <h3 className="font-medium">{t(`how.s${idx + 1}Title`)}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">{t(`how.s${idx + 1}Body`)}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="container py-24">
          <div className="max-w-xl mb-10">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <Star className="h-3 w-3 mr-1" /> {t("reviews.badge")}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("reviews.h2")}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((item, idx) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.07, ease }}
              >
                <Card className="p-6 h-full border-border/60 bg-card/90">
                  <Quote className="h-5 w-5 text-accent" />
                  <p className="mt-3 text-sm leading-relaxed">{item.body}</p>
                  <p className="mt-4 text-xs text-muted-foreground">{item.name} · {item.city}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="container pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-16">
            <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t("cta.h2")}</h2>
              <p className="mt-4 opacity-85">{t("cta.subtitle")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/membership">{t("cta.member")}</Link>
                </Button>
                <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  <Link to="/search">{t("cta.free")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
