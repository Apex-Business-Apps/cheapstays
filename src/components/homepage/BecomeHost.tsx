import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { ease } from "./constants";

export function BecomeHost() {
  return (
    <AtmosphericSection as="div" variant="lake" parallaxStrength="subtle" className="snap-landing-strip border-y border-border/60">
      <section className="container py-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-16">
          <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
            className="relative mx-auto max-w-2xl text-center flex flex-col items-center"
          >
            <Badge variant="secondary" className="mb-4 uppercase tracking-wider text-xs">
              <Handshake className="h-3 w-3 mr-1" /> Become a host
            </Badge>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              List your place. <span className="text-accent">Grow with us.</span>
            </h2>
            <p className="mt-4 max-w-md opacity-85">
              Whether you own a single beach house or manage a portfolio of condos, CheapStays connects you
              with travelers directly — fair fees, fast payouts, and real support.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/become-a-partner">Start hosting <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/host">Host tools</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </AtmosphericSection>
  );
}
