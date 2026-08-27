import { Seo } from "@/components/Seo";
import { HowItWorks } from "@/components/homepage/HowItWorks";

export default function HowItWorksPage() {
  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title="How CheapStays works"
        description="Three-step overview of finding, booking, and enjoying an owner-direct stay on CheapStays."
        path="/how-it-works"
      />
      <div className="pt-8">
        <HowItWorks />
      </div>
    </div>
  );
}
