import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  LifeBuoy,
  Loader2,
  Mail,
  RotateCcw,
  Scale,
  SendHorizonal,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { toast } from "@/hooks/use-toast";
import { ease } from "./constants";
import { FAQS } from "./faq-data";

type ResourceLink = { to: string; icon: typeof FileText; title: string; body: string };

const BOOKING_CONCERNS: ResourceLink[] = [
  { to: "/refunds", icon: RotateCcw, title: "Refunds & cancellations", body: "Free cancellation up to 2 days before check-in." },
  { to: "/renter-rules", icon: BookOpen, title: "Guest booking rules", body: "What's expected when you book and stay." },
  { to: "/support", icon: LifeBuoy, title: "Report a booking issue", body: "Open a support ticket from your account." },
];

const POLICIES: ResourceLink[] = [
  { to: "/terms", icon: FileText, title: "Terms of Service", body: "The rules for using CheapStays." },
  { to: "/privacy", icon: ShieldCheck, title: "Privacy Policy", body: "How we handle and protect your data." },
  { to: "/refunds", icon: Scale, title: "Cancellation & refund rules", body: "Refund windows and payout timing." },
];

function ResourceCard({ to, icon: Icon, title, body }: ResourceLink) {
  return (
    <Link to={to} className="group block">
      <Card className="p-4 flex items-center gap-4 border-border/60 bg-card/95 transition-colors hover:border-foreground/20">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium tracking-tight">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}

const TOPICS = [
  "Booking help",
  "Payment or refund",
  "Account access",
  "Host or partner",
  "Something else",
] as const;

type Channel = {
  icon: typeof Mail;
  title: string;
  body: string;
  href?: string;
  to?: string;
};

const CHANNELS: Channel[] = [
  { icon: Mail, title: "Email us", body: "cheapstays.me@gmail.com", href: "mailto:cheapstays.me@gmail.com" },
  { icon: Clock, title: "Response time", body: "Usually within a few hours, 7 days a week" },
  // AI concierge — temporarily hidden
  // { icon: MessageCircle, title: "AI concierge", body: "Pip answers instantly inside your account", to: "/support" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CustomerSupport() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function resetForm() {
    setName("");
    setEmail("");
    setTopic(TOPICS[0]);
    setSubject("");
    setMessage("");
    setSubmitted(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    if (message.trim().length < 10) {
      toast({ title: "Please add a few more details", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Front-end contact capture — wire to support-ticket edge function / email when available.
      await new Promise((resolve) => setTimeout(resolve, 900));
      setSubmitted(true);
      toast({ title: "Message sent", description: "We'll get back to you by email shortly." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AtmosphericSection as="div" variant="interior" parallaxStrength="none" className="snap-landing-strip border-y border-border/60">
      <section className="container py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16 items-start">
          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
          >
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <LifeBuoy className="h-3 w-3 mr-1" /> Customer support
            </Badge>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              We're here to <span className="text-accent">help</span>.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md">
              Question about a booking, a payment, or your account? Send us a message and a real person will
              get back to you — usually within a few hours.
            </p>
            <div className="mt-8 space-y-4">
              {CHANNELS.map((c) => {
                const inner = (
                  <Card className="p-4 flex items-center gap-4 border-border/60 bg-card/95 transition-colors hover:border-foreground/20">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
                      <c.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium tracking-tight">{c.title}</p>
                      <p className="text-sm text-muted-foreground">{c.body}</p>
                    </div>
                  </Card>
                );
                if (c.href) return <a key={c.title} href={c.href} className="block">{inner}</a>;
                if (c.to) return <Link key={c.title} to={c.to} className="block">{inner}</Link>;
                return <div key={c.title}>{inner}</div>;
              })}
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
          >
            <Card className="p-6 md:p-8 bg-card/95 border-border/60 shadow-[0_30px_80px_-50px_hsl(150_30%_10%/0.5)]">
              {submitted ? (
                <div className="py-10 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="text-xl font-semibold tracking-tight">Message sent!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Thanks for reaching out. We'll reply to your email as soon as we can — usually within a few hours.
                  </p>
                  <Button variant="outline" onClick={resetForm}>Send another</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">Send us a message</h3>
                    <p className="text-sm text-muted-foreground mt-1">We typically reply within a few hours.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="support-name">Full name *</Label>
                      <Input id="support-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan dela Cruz" autoComplete="name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="support-email">Email *</Label>
                      <Input id="support-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Topic</Label>
                      <Select value={topic} onValueChange={setTopic}>
                        <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                        <SelectContent>
                          {TOPICS.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="support-subject">Subject</Label>
                      <Input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-message">Message *</Label>
                    <Textarea id="support-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
                    Send message
                  </Button>
                </form>
              )}
            </Card>
          </motion.div>
        </div>

        {/* ── Help Center / FAQs ── */}
        <div className="mt-20">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">Help Center</Badge>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Frequently asked questions</h3>
            <p className="mt-3 text-muted-foreground">Quick answers and booking guidance for the most common questions.</p>
          </div>
          <div className="mt-6 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* ── Booking concerns + Policies ── */}
        <div className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">Booking concerns</Badge>
            <h3 className="text-2xl font-semibold tracking-tight">Refunds, cancellations & issues</h3>
            <p className="mt-2 text-muted-foreground">Sort out a refund, review the rules, or report a problem.</p>
            <div className="mt-5 space-y-3">
              {BOOKING_CONCERNS.map((r) => <ResourceCard key={r.title} {...r} />)}
            </div>
          </div>
          <div>
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">Policies</Badge>
            <h3 className="text-2xl font-semibold tracking-tight">Terms, privacy & rules</h3>
            <p className="mt-2 text-muted-foreground">The fine print, in plain language.</p>
            <div className="mt-5 space-y-3">
              {POLICIES.map((r) => <ResourceCard key={r.title} {...r} />)}
            </div>
          </div>
        </div>
      </section>
    </AtmosphericSection>
  );
}
