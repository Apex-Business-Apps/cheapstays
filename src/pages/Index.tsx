import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Sparkles, TrendingDown, Zap } from "lucide-react";

const features = [
  { icon: Sparkles, title: "AI deal hunter", body: "Tell our AI what you want in plain English. It scores every listing on real value, not vibes." },
  { icon: TrendingDown, title: "Owner-direct prices", body: "We surface listings priced below platform averages — no resale markup, no junk fees." },
  { icon: ShieldCheck, title: "Transparent fees", body: "Every total broken down line by line. If we can't show the math, we don't show the listing." },
  { icon: Zap, title: "Instant alerts", body: "Save a search. We ping you the second a deal drops below your number." },
];

export default function Index() {
  return (
    <div>
      <section className="container pt-20 pb-24">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="mb-6">AI-powered · zero markup</Badge>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Find it cheap.<br />
            <span className="text-primary">Stay smart.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            AI-powered short-term rental deals. Owner-direct prices. Zero markup guilt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/search">Start hunting <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/membership">See membership</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="container pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="p-6 bg-card/80 border-border/60">
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
