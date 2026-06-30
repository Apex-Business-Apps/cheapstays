import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { ease } from "./constants";

const STEP_NUMS = ["01", "02", "03"] as const;

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <AtmosphericSection variant="interior" parallaxStrength="none" className="snap-landing-panel border-y border-border/60">
      <section className="bg-card/35">
        <div className="container py-24 grid lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
          <div>
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <Waves className="h-3 w-3 mr-1" /> {t("how.badge")}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("how.h2")}</h2>
            <p className="mt-4 text-muted-foreground max-w-md">{t("how.subtitle")}</p>
            <Button className="mt-6" asChild>
              <Link to="/search">{t("how.cta")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="space-y-3">
            {STEP_NUMS.map((n, idx) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.08, ease }}
              >
                <Card className="p-6 flex gap-5 items-start border-border/60">
                  <span className="text-3xl font-semibold text-primary/70 tabular-nums">{n}</span>
                  <div>
                    <h3 className="font-medium">{t(`how.s${idx + 1}Title`)}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{t(`how.s${idx + 1}Body`)}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </AtmosphericSection>
  );
}
