import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Compass, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import s7 from "@/assets/stay-7.jpg";
import cityCebu from "@/assets/city-cebu.jpg";
import cityCoron from "@/assets/city-coron.jpg";
import emblemBeach from "@/assets/emblem-beach.png";
import emblemMountain from "@/assets/emblem-mountain.png";
import emblemHeritage from "@/assets/emblem-heritage.png";
import emblemUrban from "@/assets/emblem-urban.png";
import { ease } from "./constants";

const destinations = [
  { img: s1, name: "El Nido, Palawan",  tagline: "Limestone lagoons",       from: "₱2,400", emblem: emblemBeach },
  { img: s2, name: "Siargao",           tagline: "Surf and coconut groves", from: "₱1,650", emblem: emblemBeach },
  { img: s6, name: "Boracay",           tagline: "Powder-white sand",       from: "₱3,100", emblem: emblemBeach },
  { img: s4, name: "Batanes",           tagline: "Stone huts, green hills", from: "₱2,200", emblem: emblemMountain },
  { img: s3, name: "Bohol",             tagline: "Chocolate Hills views",   from: "₱2,900", emblem: emblemMountain },
  { img: s7, name: "Baguio",            tagline: "Cool pine highlands",     from: "₱1,950", emblem: emblemMountain },
  { img: s5, name: "Vigan",             tagline: "Heritage Spanish casas",  from: "₱1,500", emblem: emblemHeritage },
  { img: cityCebu,  name: "Cebu City",      tagline: "Skyline and sea condos",  from: "₱2,100", emblem: emblemUrban },
  { img: cityCoron, name: "Coron, Palawan", tagline: "Shipwreck diving cove",   from: "₱3,400", emblem: emblemBeach },
];

export function Destinations() {
  const { t } = useTranslation();
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  return (
    <AtmosphericSection as="div" variant="city" parallaxStrength="subtle" className="snap-landing-panel">
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
              className={`group relative overflow-hidden rounded-2xl ring-1 ring-border/60 cursor-pointer ${idx === 0 ? "sm:col-span-2 sm:row-span-2 aspect-[4/5] sm:aspect-auto" : "aspect-[4/5]"}`}
            >
              <Link to={`/search?q=${encodeURIComponent(d.name)}`} className="absolute inset-0 z-10" aria-label={`Search stays in ${d.name}`} />
              {!brokenImages[idx] ? (
                <img
                  src={d.img}
                  alt={`${d.name} — ${d.tagline}`}
                  loading="lazy"
                  width={1024}
                  height={1280}
                  className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1200ms] ease-out group-hover:scale-[1.06]"
                  onError={() => setBrokenImages((prev) => ({ ...prev, [idx]: true }))}
                />
              ) : (
                <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-secondary/60 to-accent/10 flex items-center justify-center">
                  <Compass className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
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
    </AtmosphericSection>
  );
}
