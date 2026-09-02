import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { AiChatBubble } from "@/components/AiChatBubble";

// Routes where the floating AI chat bubble is intentionally hidden.
// /search already has its own search + filter UI and the bubble competes
// with the results grid on mobile.
const HIDE_CHAT_ROUTES = ["/search"];
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
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us",       to: "/about" },
      { label: "Contact Us",     to: "/customer-support" },
      { label: "News & Updates", to: "/articles" },
    ],
  },
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
                  src="/favicon.png"
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
