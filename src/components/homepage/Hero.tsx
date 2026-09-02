import { motion } from "framer-motion";
import { HeroSearchWidget } from "./HeroSearchWidget";
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
      {/* Mobile / tablet full-bleed photo behind the entire hero (copy + search
          widget). Hidden at lg+ where the photo lives in the right grid cell. */}
      <div className="absolute inset-0 -z-10 overflow-hidden lg:hidden">
        <img
          src={heroCity}
          alt=""
          aria-hidden
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-black/55" />
      </div>

      <div className="relative lg:grid lg:grid-cols-[1fr_1fr] lg:min-h-[80dvh]">
        {/* Left copy column — centered overlay on mobile, left-aligned at lg+ */}
        <div className="relative z-10 flex flex-col justify-center items-center lg:items-start text-center lg:text-left px-6 sm:px-10 lg:px-16 pt-20 pb-10 lg:py-24 mx-auto lg:mx-0 w-full max-w-[720px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="mb-6 flex items-center gap-3"
          >
            <img
              src="/favicon.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <div className="leading-tight text-left">
              <p className="text-sm font-semibold tracking-[0.24em] uppercase text-white lg:text-foreground">
                Cheap<span className="text-primary">Stays</span>
              </p>
              <p className="text-xs text-white/85 lg:text-muted-foreground">Stay more. Pay less.</p>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.08, ease }}
            className="font-semibold tracking-tight text-white lg:text-foreground text-5xl md:text-6xl lg:text-7xl leading-[1.02]"
          >
            Stay more.
            <br />
            Pay less.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.16, ease }}
            className="mt-6 max-w-lg text-base md:text-lg text-white/85 lg:text-muted-foreground"
          >
            Quality condos and short stays in Metro Manila, without the premium price.
          </motion.p>
        </div>

        {/* Right image column — lg+ only. Own grid cell with the soft cream fade. */}
        <div className="hidden lg:block relative overflow-hidden">
          <img
            src={heroCity}
            alt="Metro Manila skyline seen from a condo balcony"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent"
          />
        </div>
      </div>

      {/* Search widget — overlays the hero photo on mobile (centered), sits as
          a full-width row below the split at lg+. */}
      <div className="relative z-20 lg:-mt-16 px-6 sm:px-10 lg:px-16 pb-10 lg:pb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease }}
          className="mx-auto max-w-6xl"
        >
          <HeroSearchWidget />
        </motion.div>
      </div>
    </section>
  );
}
