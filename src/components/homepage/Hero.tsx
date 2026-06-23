import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HeroCarousel } from "@/components/HeroCarousel";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { ease } from "./constants";

export function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <AtmosphericSection as="div" variant="beach" parallaxStrength="subtle" className="snap-landing-panel">
      <section className="container pt-14 pb-20 md:pt-20 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease }}
          >
            <Badge variant="secondary" className="mb-6 uppercase tracking-wider text-xs">
              {t("hero.badge")}
            </Badge>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.02]">
              Short or Long.<br />
              <span className="text-primary">Stay Cheap.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Smart travelers book short stays instantly or request long stays with owner-direct clarity.
            </p>
            <form onSubmit={handleSearch} className="mt-8 flex gap-2 max-w-xl">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="2 nights in Quezon City, budget ₱2,000, need WiFi…"
                aria-label="Search stays"
                className="flex-1 h-12 text-base bg-background/90 backdrop-blur"
              />
              <Button type="submit" size="lg" className="h-12 px-6">
                <Search className="h-4 w-4 mr-1.5" /> Search
              </Button>
            </form>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.15, ease }}
          >
            <HeroCarousel />
          </motion.div>
        </div>
      </section>
    </AtmosphericSection>
  );
}
