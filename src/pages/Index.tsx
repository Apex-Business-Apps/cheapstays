import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Sparkles, TrendingDown, Zap } from "lucide-react";
import { HeroCarousel } from "@/components/HeroCarousel";

const features = [
  { icon: Sparkles, title: "AI deal hunter", body: "Tell our AI what you want in plain English. It scores every listing on real value, not vibes." },
  { icon: TrendingDown, title: "Owner-direct prices", body: "We surface listings priced below platform averages — no resale markup, no junk fees." },
  { icon: ShieldCheck, title: "Transparent fees", body: "Every total broken down line by line. If we can't show the math, we don't show the listing." },
  { icon: Zap, title: "Instant alerts", body: "Save a search. We ping you the second a deal drops below your number." },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function Index() {
  return (
    <div>
      <section className="container pt-14 pb-20 md:pt-20 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease }}
          >
            <Badge variant="secondary" className="mb-6">AI-powered · zero markup</Badge>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.02]">
              Find it cheap.<br />
              <span className="text-primary">Stay smart.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              AI-powered short-term rental deals. Owner-direct prices. Zero markup guilt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="group">
                <Link to="/search">
                  Start hunting
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/membership">See membership</Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live deal scanner</span>
              <span>·</span>
              <span>7 stays cycling now</span>
            </div>
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
      <section className="container pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: idx * 0.07, ease }}
            >
              <Card className="p-6 bg-card/90 border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-30px_hsl(150_30%_10%/0.35)]">
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
