import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import s7 from "@/assets/stay-7.jpg";
import cebu from "@/assets/city-cebu.jpg";
import coron from "@/assets/city-coron.jpg";
import tagaytay from "@/assets/city-tagaytay.jpg";
import iloilo from "@/assets/city-iloilo.jpg";
import dumaguete from "@/assets/city-dumaguete.jpg";
import camiguin from "@/assets/city-camiguin.jpg";
import launion from "@/assets/city-launion.jpg";
import davao from "@/assets/city-davao.jpg";

const stays = [
  { src: s1,       label: "Bamboo villa, El Nido",    price: "₱4,800/night" },
  { src: s2,       label: "Surf bungalow, Siargao",   price: "₱2,950/night" },
  { src: s3,       label: "Hillside villa, Bohol",    price: "₱6,200/night" },
  { src: s4,       label: "Stone hut, Batanes",       price: "₱3,400/night" },
  { src: s5,       label: "Heritage casa, Vigan",     price: "₱2,100/night" },
  { src: s6,       label: "Cliff cottage, Boracay",   price: "₱5,400/night" },
  { src: s7,       label: "Pine A-frame, Baguio",     price: "₱2,750/night" },
  { src: cebu,     label: "Skyline condo, Cebu",      price: "From ₱2,300/night" },
  { src: coron,    label: "Bamboo bungalow, Coron",   price: "From ₱3,900/night" },
  { src: tagaytay, label: "Volcano cabin, Tagaytay",  price: "From ₱2,600/night" },
  { src: iloilo,   label: "Heritage casa, Iloilo",    price: "From ₱2,200/night" },
  { src: dumaguete,label: "Coastal stay, Dumaguete",  price: "From ₱2,450/night" },
  { src: camiguin, label: "Cove cottage, Camiguin",   price: "From ₱3,200/night" },
  { src: launion,  label: "Surf shack, La Union",     price: "From ₱2,700/night" },
  { src: davao,    label: "City flat, Davao",         price: "From ₱2,900/night" },
];

export const HERO_STAYS_COUNT = stays.length;
const INTERVAL = 30_000;

export function HeroCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % stays.length), INTERVAL);
    return () => clearInterval(t);
  }, []);
  const active = stays[i];
  return (<div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-[0_30px_80px_-30px_hsl(150_30%_10%/0.35)] ring-1 ring-border/60 bg-muted">
      <AnimatePresence mode="sync"><motion.img key={i} src={active.src} alt={active.label} width={1024} height={1280} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ opacity: { duration: 1.6, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 30, ease: "linear" } }} className="absolute inset-0 h-full w-full object-cover" /></AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/0 to-foreground/10" />
      <motion.div key={`meta-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3 text-background"><div><p className="text-xs uppercase tracking-[0.18em] opacity-70">Now showing</p><p className="text-lg font-medium">{active.label}</p></div><span className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">{active.price}</span></motion.div>
      <div className="absolute top-4 right-4 flex gap-1.5">{stays.map((_, idx) => (<button key={idx} aria-label={`Show stay ${idx + 1}`} onClick={() => setI(idx)} className={`h-1.5 rounded-full transition-all duration-500 ${idx === i ? "w-6 bg-background" : "w-1.5 bg-background/50 hover:bg-background/80"}`} />))}</div>
    </div>);
}
