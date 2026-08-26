import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Apple, Facebook, Instagram, Music2, Play, Youtube } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AiChatBubble } from "@/components/AiChatBubble";

// Routes where the floating AI chat bubble is intentionally hidden.
// /search already has its own search + filter UI and the bubble competes
// with the results grid on mobile.
const HIDE_CHAT_ROUTES = ["/search"];
import brandMark from "@/assets/brand-mark.png";
import { LEGAL_CONTACT_EMAIL, legalDocs } from "@/pages/legal/content";

type FooterLink = { label: string; to: string; external?: boolean };
type FooterColumn = { heading: string; links: FooterLink[] };

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Explore",
    links: [
      { label: "Home",          to: "/" },
      { label: "Stays",         to: "/types-of-stays" },
      { label: "How It Works",  to: "/how-it-works" },
      { label: "About Us",      to: "/about" },
    ],
  },
  {
    heading: "For Guests",
    links: [
      { label: "Help Center",         to: "/customer-support" },
      { label: "Terms of Use",        to: "/terms" },
      { label: "Privacy & Data",      to: "/privacy" },
      { label: "Cancellation Policy", to: "/refunds" },
    ],
  },
  {
    heading: "For Hosts",
    links: [
      { label: "List Your Property", to: "/become-a-partner" },
      { label: "Host Resources",     to: "/customer-support" },
      { label: "Pricing",            to: "/become-a-partner#pricing" },
      { label: "Success Stories",    to: "/about#stories" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us",      to: "/about" },
      { label: "Contact Us",    to: `mailto:${LEGAL_CONTACT_EMAIL}`, external: true },
      { label: "Careers",       to: "/about#careers" },
      { label: "News & Updates", to: "/about#news" },
    ],
  },
];

const SOCIALS: { label: string; href: string; icon: typeof Facebook }[] = [
  { label: "Facebook",  href: "https://facebook.com/",  icon: Facebook },
  { label: "Instagram", href: "https://instagram.com/", icon: Instagram },
  { label: "TikTok",    href: "https://tiktok.com/",    icon: Music2 },
  { label: "YouTube",   href: "https://youtube.com/",   icon: Youtube },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className = "text-sm text-muted-foreground hover:text-foreground transition-colors";
  if (link.external) {
    return (
      <a href={link.to} className={className}>
        {link.label}
      </a>
    );
  }
  return (
    <Link to={link.to} className={className}>
      {link.label}
    </Link>
  );
}

function AppBadge({
  icon: Icon,
  primary,
  secondary,
  href,
}: {
  icon: typeof Apple;
  primary: string;
  secondary: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl bg-foreground text-background px-4 py-2.5 hover:bg-foreground/90 transition-colors"
    >
      <Icon className="h-6 w-6" aria-hidden />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide opacity-75">{primary}</span>
        <span className="text-sm font-semibold">{secondary}</span>
      </span>
    </a>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const showChat = !HIDE_CHAT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>

      <footer className="mt-16 border-t border-border/60 bg-background">
        <div className="container py-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
            {/* Brand column — spans 2 columns on lg */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <img
                  src={brandMark}
                  alt="CheapStays emblem"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  loading="lazy"
                />
                <div className="leading-tight">
                  <p className="text-sm font-semibold tracking-[0.2em] uppercase text-foreground">
                    Cheap<span className="text-primary">Stays</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Stay more. Pay less.</p>
                </div>
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                {t("footer.desc", "Affordable condos and short stays in Metro Manila. Quality stays. Better prices.")}
              </p>
              <div className="mt-5 flex items-center gap-2">
                {SOCIALS.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noreferrer"
                    className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h3 className="text-sm font-semibold text-foreground">{col.heading}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* App download row */}
          <div className="mt-10 pt-8 border-t border-border/50 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-foreground">Download the app</p>
              <p className="mt-1 text-xs text-muted-foreground">Book stays and manage trips on the go.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AppBadge icon={Play}  primary="Get it on"     secondary="Google Play" href="#" />
              <AppBadge icon={Apple} primary="Download on the" secondary="App Store"   href="#" />
            </div>
          </div>

          {/* Compliance strip — full legalDocs list, kept as a flat row so
              legal-pages.test.tsx can still find every doc by its title. */}
          <nav aria-label="Legal policies" className="mt-10 pt-8 border-t border-border/40 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link className="hover:text-foreground underline-offset-4 hover:underline" to="/legal">
              Legal Center
            </Link>
            {Object.values(legalDocs)
              .filter((doc) => doc.path !== "/legal")
              .map((doc) => (
                <Link
                  key={doc.path}
                  to={doc.path}
                  className="hover:text-foreground underline-offset-4 hover:underline"
                >
                  {doc.title}
                </Link>
              ))}
          </nav>

          {/* Bottom bar */}
          <div className="mt-6 pt-6 border-t border-border/40 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} CheapStays. All rights reserved.</p>
            <p>
              Contact:{" "}
              <a className="underline underline-offset-4 hover:text-foreground" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                {LEGAL_CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </footer>

      {showChat && <AiChatBubble />}
    </div>
  );
}
