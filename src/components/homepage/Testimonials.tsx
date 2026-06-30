import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Quote, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { ease } from "./constants";

const testimonials = [
  { name: "Mika R.",    city: "Quezon City", body: "Found a Coron beachfront for ₱2,800/night that was ₱5,200 on Airbnb. Same exact unit. Never going back." },
  { name: "JP de Leon", city: "Makati",      body: "Pip sorted our whole Siargao week in five messages. Surf lessons, transfers, and a hut under budget." },
  { name: "Andrea S.",  city: "Cebu",        body: "Booked a Batanes stone house through a host I'd never have found on my own. Felt like a local secret." },
];

export function Testimonials() {
  const { t } = useTranslation();

  return (
    <AtmosphericSection as="div" variant="coastal" parallaxStrength="subtle" className="snap-landing-strip">
      <section className="container py-24">
        <div className="max-w-xl mb-10">
          <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
            <Star className="h-3 w-3 mr-1" /> {t("reviews.badge")}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("reviews.h2")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((item, idx) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.07, ease }}
            >
              <Card className="p-6 h-full border-border/60 bg-card/90">
                <Quote className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm leading-relaxed">{item.body}</p>
                <p className="mt-4 text-xs text-muted-foreground">{item.name} · {item.city}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </AtmosphericSection>
  );
}
