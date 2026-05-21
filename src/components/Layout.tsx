import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { AiChatBubble } from "@/components/AiChatBubble";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
      <footer className="border-t border-border/60 mt-24">
        <div className="container py-10 text-sm text-muted-foreground flex flex-wrap justify-between gap-4">
          <p>© {new Date().getFullYear()} cheapstays.me — Find it cheap. Stay smart.</p>
          <p className="opacity-70">AI-powered deals. Owner-direct prices. Zero markup guilt.</p>
        </div>
      </footer>
      <AiChatBubble />
    </div>
  );
}
