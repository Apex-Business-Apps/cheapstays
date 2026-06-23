import { motion } from "framer-motion";
import { Building2, Heart, MapPin, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import brandMark from "@/assets/brand-mark.png";
import { ease } from "./constants";

const VALUES = [
  { icon: Heart, title: "Traveler-first", body: "Honest, owner-direct pricing with no surprise platform markup — ever." },
  { icon: Users, title: "Community-built", body: "We champion Filipino hosts and the local stays that big platforms overlook." },
  { icon: Sparkles, title: "Quietly smart", body: "AI that does the hunting for you, so finding the right stay feels effortless." },
] as const;

const FACTS = [
  { v: "2024", label: "Founded" },
  { v: "JGP Corporation", label: "Operated by" },
  { v: "Pasig City", label: "Headquarters" },
  { v: "Philippines", label: "Proudly serving" },
] as const;

export function AboutUs() {
  return (
    <AtmosphericSection as="div" variant="neighborhood" parallaxStrength="subtle" className="snap-landing-strip border-t border-border/60">
      <section className="container py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16 items-start">
          {/* Story */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
          >
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <img src={brandMark} alt="" width={16} height={16} className="h-4 w-4 mr-1.5" /> About us
            </Badge>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Short-term stays, <span className="text-accent">the fair way</span>.
            </h2>
            <div className="mt-5 space-y-4 text-muted-foreground max-w-xl">
              <p>
                CheapStays began with a simple frustration: the exact same Philippine rental, listed for far more
                once a global platform took its cut. We thought travelers and hosts both deserved better.
              </p>
              <p>
                So we built a marketplace where owners price directly, guests pay what's fair, and an AI concierge
                does the tedious hunting — from El Nido beachfronts to Baguio pine cabins. No markup games, just
                great stays across the islands.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span>JGP Corporation · Pasig City, Metro Manila, Philippines</span>
            </div>
          </motion.div>

          {/* Values + facts */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            className="space-y-4"
          >
            {VALUES.map((v, idx) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.06, ease }}
              >
                <Card className="p-5 flex gap-4 items-start border-border/60 bg-card/95">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
                    <v.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium tracking-tight">{v.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{v.body}</p>
                  </div>
                </Card>
              </motion.div>
            ))}

            <Card className="p-6 border-border/60 bg-card/95">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.18em]">Company</span>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {FACTS.map((f) => (
                  <div key={f.label}>
                    <p className="text-lg font-semibold tracking-tight text-primary">{f.v}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">{f.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </AtmosphericSection>
  );
}
