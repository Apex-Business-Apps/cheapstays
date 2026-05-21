import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { AiChatBubble } from "@/components/AiChatBubble";
import brandMark from "@/assets/brand-mark.png";

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
      <footer className="border-t border-border/60 mt-24">
        <div className="container py-12 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={brandMark} alt="" width={32} height={32} className="h-8 w-8 object-contain" loading="lazy" />
            <p>© {new Date().getFullYear()} Cheap<span className="text-accent">Stays</span> · {t("footer.tagline")}</p>
          </div>
          <p className="opacity-70">{t("footer.desc")}</p>
        </div>
      </footer>
      <AiChatBubble />
    </div>
  );
}
