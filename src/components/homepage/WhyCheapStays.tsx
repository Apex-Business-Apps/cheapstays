import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import iconAiHunt from "@/assets/icon-ai-hunt.png";
import iconOwnerDirect from "@/assets/icon-owner-direct.png";
import iconVerified from "@/assets/icon-verified-hosts.png";
import iconPay from "@/assets/icon-flexible-pay.png";
import iconConcierge from "@/assets/icon-concierge.png";
import iconBook from "@/assets/icon-instant-book.png";
import { ease } from "./constants";

const featureIcons = [iconAiHunt, iconOwnerDirect, iconVerified, iconPay, iconConcierge, iconBook];
const FEATURE_KEYS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

export function WhyCheapStays() {
  const { t } = useTranslation();

  return (
    <AtmosphericSection as="div" variant="neighborhood" parallaxStrength="subtle" className="snap-landing-panel">
      <section className="container pb-24">
        <div className="max-w-2xl mb-12">
          <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
            {t("why.badge")}
          </Badge>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            {t("why.h2Start")}
            <span className="text-accent">{t("why.h2Accent")}</span>
            {t("why.h2End")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("why.subtitle")}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featureIcons.map((icon, idx) => {
            const k = FEATURE_KEYS[idx];
            return (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: idx * 0.06, ease }}
              >
                <Card className="group relative overflow-hidden p-7 h-full bg-card/95 border-border/60 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_80px_-40px_hsl(150_30%_10%/0.45)]">
                  <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-accent/5 blur-2xl transition-opacity duration-500 group-hover:bg-accent/15" />
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center overflow-hidden transition-transform duration-500 group-hover:scale-[1.06] group-hover:rotate-[-3deg]">
                      <img src={icon} alt="" width={64} height={64} loading="lazy" className="h-14 w-14 object-contain" />
                    </div>
                    <h3 className="mt-5 text-lg font-medium tracking-tight">{t(`why.${k}Title`)}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(`why.${k}Body`)}</p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>
    </AtmosphericSection>
  );
}
