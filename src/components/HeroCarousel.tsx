import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import s7 from "@/assets/stay-7.jpg";

const stays = [
  { src: s1, label: "Bamboo villa · El Nido, Palawan", price: "₱4,800/night" },
  { src: s2, label: "Surf bungalow · Siargao", price: "₱2,950/night" },
  { src: s3, label: "Hillside villa · Bohol", price: "₱6,200/night" },
  { src: s4, label: "Stone hut · Batanes", price: "₱3,400/night" },
  { src: s5, label: "Heritage casa · Vigan", price: "₱2,100/night" },
  { src: s6, label: "Cliff cottage · Boracay", price: "₱5,400/night" },
  { src: s7, label: "Pine A-frame · Baguio", price: "₱2,750/night" },
];

const INTERVAL = 30_000;

export function HeroCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % stays.length), INTERVAL);
    return () => clearInterval(t);
  }, []);
  const active = stays[i];
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-[0_30px_80px_-30px_hsl(150_30%_10%/0.35)] ring-1 ring-border/60 bg-muted">
      <AnimatePresence mode="sync">
        <motion.img
          key={i}
          src={active.src}
          alt={active.label}
          width={1024}
          height={1280}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ opacity: { duration: 1.6, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 30, ease: "linear" } }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/0 to-foreground/10" />
      <motion.div
        key={`meta-${i}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3 text-background"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.18em] opacity-70">Now showing</p>
          <p className="text-lg font-medium">{active.label}</p>
        </div>
        <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
          {active.price}
        </span>
      </motion.div>
      <div className="absolute top-4 right-4 flex gap-1.5">
        {stays.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Show stay ${idx + 1}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === i ? "w-6 bg-background" : "w-1.5 bg-background/50 hover:bg-background/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}