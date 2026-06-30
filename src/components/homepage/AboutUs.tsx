import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Heart, Images, Mail, MapPin, MessageCircleQuestion, SendHorizonal, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { toast } from "@/hooks/use-toast";
import brandMark from "@/assets/brand-mark.png";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import { FAQS } from "./faq-data";
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

const GALLERY = [
  { img: s1, caption: "El Nido, Palawan" },
  { img: s2, caption: "Siargao" },
  { img: s6, caption: "Boracay" },
  { img: s4, caption: "Batanes" },
  { img: s3, caption: "Bohol" },
  { img: s5, caption: "Vigan" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AboutUs() {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setSubscribing(true);
    try {
      // Front-end capture — wire to a newsletter/email provider when available.
      await new Promise((resolve) => setTimeout(resolve, 700));
      toast({ title: "You're on the list!", description: "We'll send exclusive deals and promos to your inbox." });
      setEmail("");
    } finally {
      setSubscribing(false);
    }
  }

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

        {/* ── Branding ── */}
        <div className="mt-20">
          <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">Branding</Badge>
          <Card className="p-6 md:p-8 border-border/60 bg-card/95 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
                <img src={brandMark} alt="CheapStays mark" width={36} height={36} className="h-9 w-9" />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  Cheap<span className="text-accent">Stays</span>
                </p>
                <p className="text-sm text-muted-foreground">Short-term stays, the fair way.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed md:border-l md:border-border/60 md:pl-6 max-w-xl">
              Warm, honest, and unmistakably Filipino. Our brand stands for fair pricing, owner-direct trust, and
              effortless discovery — from island coves to highland cabins.
            </p>
          </Card>
        </div>

        {/* ── Gallery ── */}
        <div className="mt-16">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <Images className="h-3 w-3 mr-1" /> Gallery
            </Badge>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Stays across the islands</h3>
            <p className="mt-3 text-muted-foreground">A glimpse of the places our community calls home base.</p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {GALLERY.map((g, idx) => (
              <motion.div
                key={g.caption}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: idx * 0.05, ease }}
                className="group relative overflow-hidden rounded-2xl ring-1 ring-border/60 aspect-[4/3]"
              >
                <img
                  src={g.img}
                  alt={g.caption}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1200ms] ease-out group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
                <p className="absolute bottom-3 left-3 text-sm font-medium text-background">{g.caption}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mt-16">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <MessageCircleQuestion className="h-3 w-3 mr-1" /> FAQs
            </Badge>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Good to know</h3>
            <p className="mt-3 text-muted-foreground">Quick answers to the questions we hear most.</p>
          </div>
          <div className="mt-6 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`about-faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* ── Signup for exclusive deals and promos ── */}
        <div className="mt-16">
          <Card className="relative overflow-hidden p-8 md:p-12 border-border/60 bg-primary text-primary-foreground">
            <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative grid gap-6 md:grid-cols-[1fr_1fr] md:items-center">
              <div>
                <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs text-foreground">
                  <Mail className="h-3 w-3 mr-1" /> Newsletter
                </Badge>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Exclusive deals and promos</h3>
                <p className="mt-2 opacity-85 max-w-md">
                  Join our list for members-only rates, seasonal promos, and new island stays — straight to your inbox.
                </p>
              </div>
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  className="bg-background text-foreground"
                  aria-label="Email address"
                />
                <Button type="submit" variant="secondary" disabled={subscribing} className="shrink-0">
                  {subscribing ? "Joining…" : <>Sign up <SendHorizonal className="ml-2 h-4 w-4" /></>}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </section>
    </AtmosphericSection>
  );
}
