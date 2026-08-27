import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Clock,
  CreditCard,
  Mail,
  MessageCircle,
  Phone,
  Search as SearchIcon,
  TicketPercent,
  User,
} from "lucide-react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LEGAL_CONTACT_EMAIL } from "@/pages/legal/content";
const heroInterior = "/wallpapers/condominium-photo-2.png";

const ease = [0.22, 1, 0.36, 1] as const;

const QUICK_ACTIONS = [
  { icon: CalendarCheck2, title: "Booking Help",    body: "Get help with your booking",    to: "#browse-topics" },
  { icon: CreditCard,     title: "Payment Help",    body: "Payment & refund concerns",     to: "#browse-topics" },
  { icon: MessageCircle,  title: "Contact Support", body: "Talk to our support team",      to: "#contact" },
];

const TOPICS = [
  { icon: CalendarDays,   title: "Bookings",            body: "Change, cancellations, check-in, and reservations.",   to: "#faq" },
  { icon: CreditCard,     title: "Payments",            body: "Charges, refunds, payment methods, and receipts.",     to: "#faq" },
  { icon: BedDouble,      title: "Your Stay",           body: "Property details, check-in instructions, and concerns.", to: "#faq" },
  { icon: TicketPercent,  title: "Stay Vouchers",       body: "Buying, sending, and using CheapStays vouchers.",      to: "/stay-vouchers" },
  { icon: User,           title: "Account",             body: "Login, personal information, and account concerns.",   to: "#faq" },
  { icon: Building2,      title: "For Property Owners", body: "Listings, bookings, payouts, and partner support.",    to: "/become-a-partner" },
];

const TOPIC_OPTIONS = [
  "Booking",
  "Payment or refund",
  "Property or stay",
  "Stay vouchers",
  "Account",
  "Listing my property",
  "Something else",
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I book a stay?",
    a: "Search by city, pick your dates and guest count, then choose a listing. Confirm details and pay through our secure checkout to lock in the booking.",
  },
  {
    q: "Can I book for just one night?",
    a: "Yes, as long as the listing's minimum-nights setting allows it. Each host can set a minimum that suits the property.",
  },
  {
    q: "What types of stays can I book?",
    a: "Overnight condos, apartments, and short-stay motels across Metro Manila. You can also redeem prepaid Stay Vouchers on participating listings.",
  },
  {
    q: "How will I receive my booking confirmation?",
    a: "You receive a confirmation email as soon as payment succeeds, and the booking also appears in My Bookings when signed in.",
  },
  {
    q: "Can I change my booking dates?",
    a: "Contact the host directly through the booking to request a date change. Availability and any price difference are up to the host.",
  },
  {
    q: "Can I cancel my booking?",
    a: "You can request a cancellation up to two days before check-in for a refund. Timing rules follow the listing's refund policy.",
  },
  {
    q: "What payment methods are accepted?",
    a: "GCash, Maya, and major credit or debit cards through PayMongo. Prepaid, gift, and anonymous reloadable cards are not accepted.",
  },
  {
    q: "How do Stay Vouchers work?",
    a: "Buy a voucher for a fixed number of nights at a set price, then hand the code to the host at check-in. Codes are valid for the batch window shown at purchase.",
  },
  {
    q: "Are the properties verified?",
    a: "Hosts complete identity verification before their listings go live. Photos and descriptions are reviewed before publication.",
  },
  {
    q: "How do I list my property on CheapStays?",
    a: "Head to List Your Property, complete host verification, then publish your first listing. Our team can help with pricing hints and photo guidance.",
  },
  {
    q: "How much does CheapStays charge property owners?",
    a: "Our platform fee is lower than most alternatives so hosts keep more of what they earn. See the pricing details on the List Your Property page.",
  },
];

export default function CustomerSupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [ref, setRef] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Non-wired: open the visitor's mail client with a pre-filled draft. The
    // support-ticket edge function requires auth; unauthenticated visitors
    // still deserve a working reach-out path, so we fall back to mailto.
    const subject = topic ? `[Support] ${topic}` : "[Support] Inquiry";
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      ref ? `Booking reference: ${ref}` : null,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title="Customer Support · CheapStays"
        description="Get help with bookings, payments, stays, vouchers, and your account. Contact the CheapStays support team or browse frequently asked questions."
        path="/customer-support"
      />

      {/* Hero — below lg the photo is full-bleed behind centered copy (same
          overlay pattern as the /about hero); at lg+ splits into left copy /
          right photo with a soft cream fade. */}
      <section className="relative isolate">
        <div className="relative lg:grid lg:grid-cols-[1.05fr_1fr] lg:min-h-[68dvh]">
          {/* Mobile / tablet full-bleed photo behind the copy. Hidden at lg+
              where the photo lives in its own grid cell on the right. */}
          <div className="absolute inset-0 -z-10 overflow-hidden lg:hidden">
            <img
              src={heroInterior}
              alt=""
              aria-hidden
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-black/55" />
          </div>

          <div className="relative z-10 flex flex-col justify-center items-center lg:items-start text-center lg:text-left px-6 sm:px-10 lg:px-16 py-20 lg:py-24 min-h-[92dvh] lg:min-h-0 mx-auto lg:mx-0 w-full max-w-[720px]">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
              className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white lg:text-foreground leading-[1.05]"
            >
              How can<br />we help?
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease }}
              className="mt-5 max-w-md text-base text-white/85 lg:text-muted-foreground"
            >
              Find quick answers about bookings, payments, vouchers, stays, and your account.
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease }}
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault();
                const target = document.getElementById("faq");
                if (target) target.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-8 flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.35)] w-full max-w-lg"
              role="search"
              aria-label="Search help topics"
            >
              <SearchIcon className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
              <Input
                type="search"
                placeholder="Search for help..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/70 px-0"
                aria-label="Search help topics"
              />
            </motion.form>
          </div>

          {/* Photo column — lg+ only. Own grid cell with a left-edge cream
              gradient so it fades cleanly into the copy column. */}
          <div className="hidden lg:block relative overflow-hidden">
            <img
              src={heroInterior}
              alt="Condo living room with a warm sofa and a Metro Manila skyline view"
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent"
            />
          </div>
        </div>

        {/* Quick action tiles — full-width row below the split, native scale */}
        <div className="relative z-20 -mt-10 lg:-mt-14 px-6 sm:px-10 lg:px-16 pb-6">
          <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {QUICK_ACTIONS.map(({ icon: Icon, title, body, to }) => (
              <Link
                key={title}
                to={to}
                className="group flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-4 shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.25)] hover:shadow-[0_20px_60px_-20px_hsl(30_20%_15%/0.35)] transition-shadow"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
                  <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact section */}
      <section id="contact" className="container py-14 md:py-20">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Need assistance?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Send us a message and our support team will get back to you.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                autoComplete="name"
                aria-label="Name"
              />
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                autoComplete="email"
                aria-label="Email address"
              />
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger aria-label="Topic">
                  <SelectValue placeholder="What do you need help with?" />
                </SelectTrigger>
                <SelectContent>
                  {TOPIC_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Booking Reference (Optional)"
                aria-label="Booking reference (optional)"
              />
              <Textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message"
                rows={5}
                aria-label="Message"
              />
              <div className="mt-2">
                <Button
                  type="submit"
                  className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-6"
                >
                  Send Message
                </Button>
                {sent && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Opening your email client with the message drafted.
                  </p>
                )}
              </div>
            </form>
          </div>

          <aside className="rounded-3xl bg-card border border-border/60 p-6 md:p-8 flex flex-col gap-6">
            <h3 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
              Prefer to reach us directly?
            </h3>

            <ContactRow icon={Mail} title="Email">
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-sm text-foreground hover:underline"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </ContactRow>
            <ContactRow icon={Clock} title="Support Hours">
              <p className="text-sm text-foreground">Daily, 8:00 AM to 9:00 PM</p>
            </ContactRow>
            <ContactRow icon={Phone} title="Phone / Viber">
              <p className="text-sm text-foreground">+63 917 123 4567</p>
            </ContactRow>
            <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              We usually reply within 24 hours.
            </div>
          </aside>
        </div>
      </section>

      {/* Browse by topic */}
      <section id="browse-topics" className="container py-4 md:py-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-6">
          Browse by topic
        </h2>
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(({ icon: Icon, title, body, to }) => (
            <Link
              key={title}
              to={to}
              className="group relative flex items-start gap-4 rounded-2xl bg-card border border-border/60 p-5 md:p-6 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.35)] transition-shadow"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
                <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
              </span>
              <div className="min-w-0 pr-8">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
              <ArrowRight
                className="absolute right-5 bottom-5 h-4 w-4 text-primary transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container py-12 md:py-16">
        <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-10">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="divide-y divide-border/50">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-0">
                <AccordionTrigger className="text-left text-sm md:text-base font-medium text-foreground hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">
          {title}
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
