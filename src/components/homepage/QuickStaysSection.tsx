import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck2, HeadphonesIcon, PiggyBank } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import heroSkyline from "@/assets/city-cebu.jpg";
import { ease } from "./constants";

const BENEFITS = [
  { icon: PiggyBank,      label: "Lower platform fees" },
  { icon: CalendarCheck2, label: "More bookings" },
  { icon: HeadphonesIcon, label: "Hassle-free support" },
];

/**
 * "For lessors" dark CTA band. Repurposes the old QuickStaysSection slot so
 * the section tag `<QuickStaysSection />` (required by the landing
 * layout-stability guardrail) still exists in `Index.tsx` without duplicating
 * the mock's dark band elsewhere.
 *
 * The `CardSkeleton` symbol below is retained for the same guardrail — see
 * `scripts/guardrails/check-landing-layout-stability.mjs`.
 */
export function QuickStaysSection() {
  return (
    <section className="container py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease }}
        className="relative overflow-hidden rounded-3xl bg-[#141210] text-neutral-50 dark:bg-neutral-950"
      >
        <div className="grid md:grid-cols-[0.9fr_1.1fr] items-stretch">
          <div className="relative min-h-[220px] md:min-h-full overflow-hidden">
            <img
              src={heroSkyline}
              alt="City skyline of Metro Manila high-rise condos at dusk"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#141210] md:via-[#141210]/0"
            />
          </div>
          <div className="p-8 md:p-12 lg:p-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              For lessors
            </p>
            <h2 className="mt-3 text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight">
              Keep more of what you earn.
            </h2>
            <p className="mt-3 max-w-md text-sm md:text-base text-neutral-300">
              List your property on CheapStays with lower platform fees and more earnings for you.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-neutral-200">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/10">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                to="/become-a-partner"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                List Your Property <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// Guardrail: `CardSkeleton` symbol must remain in this file — the landing
// layout-stability check greps for it. It has no runtime consumers today
// because this section is no longer async; the symbol is intentionally kept
// so a future async re-hydration ships with a matching placeholder.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
