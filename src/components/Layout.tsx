import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { AiChatBubble } from "@/components/AiChatBubble";
import brandMark from "@/assets/brand-mark.png";
import { LEGAL_CONTACT_EMAIL, legalDocs } from "@/pages/legal/content";

const publicPolicyLinks = Object.values(legalDocs)
  .filter((doc) => doc.path !== "/legal")
  .map((doc) => ({ label: doc.title, path: doc.path }));

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
      <footer className="snap-landing-footer mt-16 border-t border-border/60">
        <div className="container grid gap-8 py-10 text-sm text-muted-foreground md:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <img src={brandMark} alt="CheapStays emblem" width={32} height={32} className="h-8 w-8 object-contain" loading="lazy" />
              <p>© {new Date().getFullYear()} Cheap<span className="text-accent">Stays</span> · {t("footer.tagline")}</p>
            </div>
            <p className="mb-3 opacity-70">{t("footer.desc")}</p>
            <p className="text-xs">Official contact: <a className="underline underline-offset-4" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></p>
          </div>

          <nav aria-label="Legal pages" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link className="underline-offset-4 hover:underline" to="/legal">Legal Center</Link>
            {publicPolicyLinks.map((link) => (
              <Link key={link.path} className="underline-offset-4 hover:underline" to={link.path}>{link.label}</Link>
            ))}
          </nav>
        </div>
      </footer>
      <AiChatBubble />
    </div>
  );
}
