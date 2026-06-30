import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtmosphericSection } from "@/components/AtmosphericSection";

export function FinalCta() {
  const { t } = useTranslation();

  return (
    <AtmosphericSection as="div" variant="coastal" parallaxStrength="subtle" className="snap-landing-strip">
      <section className="container py-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-16">
          <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t("cta.h2")}</h2>
            <p className="mt-4 opacity-85">{t("cta.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/membership">{t("cta.member")}</Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/search">{t("cta.free")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </AtmosphericSection>
  );
}
