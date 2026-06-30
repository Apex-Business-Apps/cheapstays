import { useEffect } from "react";
import { Seo } from "@/components/Seo";
import {
  Hero,
  PopularCitiesSection,
  FeaturedStaysSection,
  QuickStaysSection,
  BecomeHost,
} from "@/components/homepage";

// Sections moved to dedicated nav pages: BecomePartner, CustomerSupport, AboutUs.
// Other sections kept for re-use: Destinations, WhyCheapStays, StatsStrip, CityStaycations, HowItWorks, Testimonials, FinalCta.

export default function Index() {
  useEffect(() => {
    document.body.classList.add("snap-landing-active");
    return () => document.body.classList.remove("snap-landing-active");
  }, []);

  return (
    <div>
      <Seo
        title="CheapStays"
        description="Short-term rentals across the Philippines with owner-direct pricing and no platform markup."
        path="/"
      />
      <div className="snap-landing-page">
        <Hero />
        <PopularCitiesSection />
        <FeaturedStaysSection />
        <QuickStaysSection />
        <BecomeHost />
      </div>
    </div>
  );
}
