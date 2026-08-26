import { Seo } from "@/components/Seo";
import {
  Hero,
  VoucherDealsSection,
  PopularCitiesSection,
  FeaturedStaysSection,
  QuickStaysSection,
  BecomeHost,
} from "@/components/homepage";

// Sections moved to dedicated nav pages: BecomePartner, CustomerSupport, AboutUs.
// Other sections kept for re-use: Destinations, WhyCheapStays, StatsStrip, CityStaycations, HowItWorks, Testimonials, FinalCta.

// GUARDRAIL: never re-enable body-level scroll snapping here (the old
// "snap-landing-active" body class). Snap containers disable browser scroll
// anchoring, so the async section loads (skeleton → data) shoved the whole
// page around and forced every panel to 100svh. See CLAUDE.md §17.

export default function Index() {
  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title="CheapStays"
        description="Short-term rentals across the Philippines with owner-direct pricing and no platform markup."
        path="/"
      />
      <Hero />
      <VoucherDealsSection />
      <PopularCitiesSection />
      <FeaturedStaysSection />
      <QuickStaysSection />
      <BecomeHost />
    </div>
  );
}
