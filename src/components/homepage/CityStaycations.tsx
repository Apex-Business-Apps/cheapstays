import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import cityCebu from "@/assets/city-cebu.jpg";
import cityDavao from "@/assets/city-davao.jpg";
import cityTagaytay from "@/assets/city-tagaytay.jpg";
import cityLaUnion from "@/assets/city-launion.jpg";
import cityDumaguete from "@/assets/city-dumaguete.jpg";
import cityCoron from "@/assets/city-coron.jpg";
import cityIloilo from "@/assets/city-iloilo.jpg";
import cityCamiguin from "@/assets/city-camiguin.jpg";
import emblemBeach from "@/assets/emblem-beach.png";
import emblemMountain from "@/assets/emblem-mountain.png";
import emblemHeritage from "@/assets/emblem-heritage.png";
import emblemUrban from "@/assets/emblem-urban.png";
import brandMark from "@/assets/brand-mark.png";
import { ease } from "./constants";

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

export function CityStaycations() {
  const { t } = useTranslation();

  return (
    <AtmosphericSection as="section" variant="lake" parallaxStrength="subtle" className="snap-landing-panel border-y border-border/60">
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
                <Link to={`/search?q=${encodeURIComponent(c.name)}`} className="absolute inset-0 z-10" aria-label={`Search stays in ${c.name}`} />
                <div className="relative aspect-[5/4] overflow-hidden">
                  <img
                    src={c.img}
                    alt={`${c.name} — ${c.tagline}`}
                    loading="lazy"
                    width={1280}
                    height={1024}
                    className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1400ms] ease-out group-hover:scale-[1.08]"
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
    </AtmosphericSection>
  );
}
