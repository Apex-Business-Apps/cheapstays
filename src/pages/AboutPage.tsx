import { Seo } from "@/components/Seo";
import { AboutUs, Testimonials } from "@/components/homepage";

export default function AboutPage() {
  return (
    <div>
      <Seo
        title="About Us · CheapStays"
        description="CheapStays is a Philippine short-term rental marketplace built on fair, owner-direct pricing. Operated by JGP Corporation, Pasig City."
        path="/about"
      />
      <AboutUs />
      {/* Reviews — reuses the existing Testimonials section */}
      <Testimonials />
    </div>
  );
}
