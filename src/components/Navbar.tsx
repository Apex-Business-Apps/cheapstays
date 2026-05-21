import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Navbar() {
  const { user, signOut, roles } = useAuth();
  const { t } = useTranslation();
  const [brandAsset, setBrandAsset] = useState<"wordmark" | "icon" | "text">("wordmark");

  const links = [
    { to: "/search",     label: t("nav.search") },
    { to: "/membership", label: t("nav.membership") },
    { to: "/host",       label: t("nav.host") },
    { to: "/support",    label: t("nav.support") },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="group flex h-full items-center font-semibold tracking-tight shrink-0">
          {brandAsset === "text" ? (
            <span className="text-lg">Cheap<span className="text-accent">Stays</span></span>
          ) : (
            <img
              src={brandAsset === "wordmark" ? `/wordmark.png?v=${__CACHE_BUST__}` : `/favicon.png?v=${__CACHE_BUST__}`}
              alt={brandAsset === "wordmark" ? "CheapStays wordmark" : "CheapStays mark"}
              className={`w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02] ${
                brandAsset === "wordmark" ? "h-[90%] max-w-[200px]" : "h-10 max-w-10 rounded-md"
              }`}
              onError={() =>
                setBrandAsset((cur) => (cur === "wordmark" ? "icon" : "text"))
              }
            />
          )}
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {roles.includes("admin") && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-1 shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />
          {user ? (
            <Button size="sm" variant="ghost" onClick={signOut}>
              <span className="hidden sm:inline">{t("nav.signOut")}</span>
              <span className="sm:hidden">Out</span>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
