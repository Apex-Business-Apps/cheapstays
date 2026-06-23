import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bed,
  BedDouble,
  Building,
  Building2,
  Clock,
  LayoutGrid,
  Moon,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { AtmosphericSection } from "@/components/AtmosphericSection";

const ease = [0.22, 1, 0.36, 1] as const;

type StayType = {
  icon: typeof Bed;
  title: string;
  body: string;
  to: string;
};

const STAY_TYPES: StayType[] = [
  { icon: Clock, title: "Hourly stays", body: "Pay by the hour — 3, 6, or 12-hour blocks for a quick rest or refresh.", to: "/search?availability=hourly" },
  { icon: Zap, title: "Quick stays", body: "Instant-book rooms for last-minute plans and short stopovers.", to: "/search?category=quick_stay" },
  { icon: Moon, title: "Overnight stays", body: "Simple one-night rooms when you just need a place to sleep.", to: "/search?category=overnight_stay" },
  { icon: BedDouble, title: "Hotel rooms", body: "Boutique and budget hotel rooms across the islands.", to: "/search?category=hotel_room" },
  { icon: Bed, title: "Motel rooms", body: "Verified, hourly-friendly motel rooms at honest prices.", to: "/search?category=motel_room" },
  { icon: Building2, title: "Condos", body: "Self-contained condo units with kitchens and city views.", to: "/search?category=condo" },
  { icon: Building, title: "Apartments", body: "Whole apartments ideal for longer stays and small groups.", to: "/search?category=apartment" },
  { icon: Waves, title: "Private pool stays", body: "Villas and homes with a pool to yourself.", to: "/search?category=private_pool" },
  { icon: Users, title: "Hostels", body: "Social, wallet-friendly beds for solo and budget travelers.", to: "/search?category=hostel" },
];

export default function TypesOfStays() {
  return (
    <div>
      <Seo
        title="Types of Stays · CheapStays"
        description="Browse every kind of stay on CheapStays — hourly rooms, quick stays, hotels, motels, condos, apartments, private-pool villas, and hostels."
        path="/types-of-stays"
      />
      <AtmosphericSection as="div" variant="city" parallaxStrength="subtle">
        <section className="container py-16 md:py-20">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <LayoutGrid className="h-3 w-3 mr-1" /> Types of stays
            </Badge>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Every kind of stay, <span className="text-accent">one fair marketplace</span>.
            </h1>
            <p className="mt-4 text-muted-foreground">
              From an hourly room to a private-pool villa — pick how you want to stay and we'll show you live,
              owner-direct listings.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STAY_TYPES.map((t, idx) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: idx * 0.04, ease }}
              >
                <Card className="group relative h-full p-6 border-border/60 bg-card/95 transition-all duration-500 hover:-translate-y-1.5 hover:border-foreground/20 hover:shadow-[0_30px_80px_-50px_hsl(150_30%_10%/0.5)]">
                  <Link to={t.to} className="absolute inset-0 z-10" aria-label={`Browse ${t.title}`} />
                  <div className="h-12 w-12 rounded-xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
                    <t.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="mt-4 text-lg font-medium tracking-tight">{t.title}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{t.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Browse <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Button asChild>
              <Link to="/search">Search all stays <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </AtmosphericSection>
    </div>
  );
}
