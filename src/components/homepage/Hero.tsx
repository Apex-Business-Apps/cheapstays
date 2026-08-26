import { motion } from "framer-motion";
import { HeroSearchWidget } from "./HeroSearchWidget";
import brandMark from "@/assets/brand-mark.png";
import heroCity from "@/assets/city-cebu.jpg";
import { ease } from "./constants";

/**
 * Landing hero — warm marketplace layout.
 *
 * Left column carries the brand strip, display headline, and subtext.
 * Right column bleeds a Metro Manila cityscape photo to the viewport edge.
 * The hero search widget sits at the bottom of the split, overlapping the
 * boundary between hero and the summary strip below.
 *
 * Layout: `min-h-[92dvh]` on desktop keeps the search widget above the fold
 * without pinning to the viewport (which would break scroll anchoring in
 * ways the landing-layout-stability guardrail already burned us on).
 */
export function Hero() {
  return (
    <section className="relative isolate">
      <div className="relative grid lg:grid-cols-[1fr_1fr] lg:min-h-[92dvh]">
        {/* Left copy column */}
        <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 pt-16 pb-40 lg:pt-24 lg:pb-56 max-w-[720px]">
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

        {/* Search widget — overlaps the bottom of the hero on desktop */}
        <div className="col-span-full absolute inset-x-0 bottom-0 translate-y-1/2 hidden lg:block z-20 px-6 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease }}
            className="mx-auto max-w-6xl"
          >
            <HeroSearchWidget />
          </motion.div>
        </div>
      </div>

      {/* Mobile search widget — inline below the hero */}
      <div className="lg:hidden px-6 -mt-10 relative z-20">
        <HeroSearchWidget />
      </div>

      {/* Spacer to reserve room for the absolute-positioned desktop widget */}
      <div className="hidden lg:block h-24" aria-hidden />
    </section>
  );
}
