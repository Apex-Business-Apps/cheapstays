import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { AiChatBubble } from "@/components/AiChatBubble";
import brandMark from "@/assets/brand-mark.png";
import { LEGAL_CONTACT_EMAIL } from "@/pages/legal/content";

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
      <footer className="mt-16 border-t border-border/60">
        <div className="container py-10 text-sm text-muted-foreground">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <img src={brandMark} alt="CheapStays emblem" width={32} height={32} className="h-8 w-8 object-contain" loading="lazy" />
            <p>© {new Date().getFullYear()} Cheap<span className="text-accent">Stays</span> · {t("footer.tagline")}</p>
          </div>
          <p className="mb-3 opacity-70">{t("footer.desc")}</p>
          <p className="text-xs">Official contact: <a className="underline underline-offset-4" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></p>
        </div>
      </footer>
      <AiChatBubble />
    </div>
  );
}
