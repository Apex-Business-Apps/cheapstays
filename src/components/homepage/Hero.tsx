import { motion } from "framer-motion";
import { HeroSearchWidget } from "./HeroSearchWidget";
import brandMark from "@/assets/brand-mark.png";
import heroCity from "@/assets/city-cebu.jpg";
import { ease } from "./constants";

/**
 * Landing hero — warm marketplace layout.
 *
 * Left column carries the brand strip, display headline, subtext, and the
 * search widget in natural flow. Right column bleeds a Metro Manila
 * cityscape photo to the viewport edge on desktop and sits above the copy
 * on mobile.
 */
export function Hero() {
  return (
    <section className="relative isolate">
      <div className="relative grid lg:grid-cols-[1fr_1fr] lg:min-h-[92dvh]">
        {/* Left copy column */}
        <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-16 lg:py-24 max-w-[720px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="mb-6 flex items-center gap-3"
          >
            <img
              src={brandMark}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-[0.24em] uppercase text-foreground">
                Cheap<span className="text-primary">Stays</span>
              </p>
              <p className="text-xs text-muted-foreground">Stay more. Pay less.</p>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.08, ease }}
            className="font-semibold tracking-tight text-foreground text-5xl md:text-6xl lg:text-7xl leading-[1.02]"
          >
            Stay more.
            <br />
            Pay less.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.16, ease }}
            className="mt-6 max-w-lg text-base md:text-lg text-muted-foreground"
          >
            Quality condos and short stays in Metro Manila, without the premium price.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease }}
            className="mt-8"
          >
            <HeroSearchWidget />
          </motion.div>
        </div>

        {/* Right image column — bleeds to viewport edge on desktop, sits above copy on mobile */}
        <div className="relative order-first lg:order-none min-h-[280px] md:min-h-[360px] lg:min-h-0 overflow-hidden">
          <img
            src={heroCity}
            alt="Metro Manila skyline seen from a condo balcony"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Soft warm gradient so the copy column blends into the photo on desktop */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent lg:from-background lg:via-background/60 lg:to-transparent"
          />
        </div>
      </div>
    </section>
  );
}
