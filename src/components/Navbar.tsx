import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { isHost } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationsModal } from "@/components/NotificationsModal";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const { user, signOut, roles } = useAuth();
  const { t } = useTranslation();
  const [brandAsset, setBrandAsset] = useState<"wordmark" | "icon" | "text">("wordmark");
  const [mobileOpen, setMobileOpen] = useState(false);

  // /notifications is desktop-only; mobile/tablet use the NotificationsModal bell icon
  const mobileLinks = [
    { to: "/search",     label: t("nav.search") },
    { to: "/membership", label: t("nav.membership") },
    { to: "/host",       label: t("nav.host") },
    { to: "/support",    label: t("nav.support") },
    ...(user ? [{ to: "/my-bookings", label: "My Bookings" }] : []),
  ];
  const desktopLinks = [
    ...mobileLinks,
    { to: "/notifications", label: "Notifications" },
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      isActive
        ? "bg-secondary text-secondary-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      {/* Override container's 2rem padding on mobile to prevent overflow */}
      <div className="container !px-4 sm:!px-8 flex h-16 items-center justify-between gap-2">
        {/* Logo — constrained on mobile so right-side buttons fit */}
        <Link to="/" className="group flex h-full items-center font-semibold tracking-tight shrink-0 min-w-0">
          {brandAsset === "text" ? (
            <span className="text-lg">Cheap<span className="text-accent">Stays</span></span>
          ) : (
            <img
              src={brandAsset === "wordmark" ? `/wordmark.png?v=${__CACHE_BUST__}` : `/favicon.png?v=${__CACHE_BUST__}`}
              alt={brandAsset === "wordmark" ? "CheapStays wordmark" : "CheapStays mark"}
              className={`w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02] ${
                brandAsset === "wordmark" ? "h-[90%] max-w-[120px] sm:max-w-[200px]" : "h-10 max-w-10 rounded-md"
              }`}
              onError={() =>
                setBrandAsset((cur) => (cur === "wordmark" ? "icon" : "text"))
              }
            />
          )}
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {desktopLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass}>
              {l.label}
            </NavLink>
          ))}
          {roles.includes("admin") && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          )}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Bell icon for mobile/tablet – opens NotificationsModal */}
          <NotificationsModal />
          {/* LanguageSwitcher hidden on mobile — available in the hamburger drawer */}
          <span className="hidden sm:flex"><LanguageSwitcher /></span>
          <ThemeToggle />
          {/* CTA logic:
              - Logged out  → Separate Sign up + Log in CTAs
              - Logged in, not host → Apply as Host + Sign Out
              - Logged in, host/admin → Host tools + Sign Out */}
          {!user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/auth?mode=signin">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth?mode=signup">Sign up</Link>
              </Button>
            </div>
          ) : isHost(roles) ? (
            <>
              <Button size="sm" variant="outline" asChild className="hidden sm:flex">
                <Link to="/host">Host tools</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={signOut} className="hidden sm:flex">
                {t("nav.signOut")}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" asChild className="hidden sm:flex">
                <Link to="/host/apply">Apply as Host</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={signOut} className="hidden sm:flex">
                {t("nav.signOut")}
              </Button>
            </>
          )}
          {/* Hamburger button — mobile only */}
          <button
            className="block lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur px-4 pb-4 pt-2">
          <ul className="flex flex-col gap-1">
            {mobileLinks.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-3 text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
            {roles.includes("admin") && (
              <li>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-3 text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  Admin
                </NavLink>
              </li>
            )}
            {/* Auth + language in mobile drawer — mirrors desktop logic */}
            <li className="pt-2 border-t border-border/40 flex items-center gap-2 flex-wrap">
              {!user ? (
                <>
                  <Button size="sm" variant="outline" asChild className="min-h-[44px]" onClick={() => setMobileOpen(false)}>
                    <Link to="/auth?mode=signin">Log in</Link>
                  </Button>
                  <Button size="sm" asChild className="min-h-[44px]" onClick={() => setMobileOpen(false)}>
                    <Link to="/auth?mode=signup">Sign up</Link>
                  </Button>
                </>
              ) : isHost(roles) ? (
                <>
                  <Button size="sm" variant="outline" asChild className="min-h-[44px]">
                    <Link to="/host" onClick={() => setMobileOpen(false)}>Host tools</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { signOut(); setMobileOpen(false); }} className="min-h-[44px]">
                    {t("nav.signOut")}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" asChild className="min-h-[44px]">
                    <Link to="/host/apply" onClick={() => setMobileOpen(false)}>Apply as Host</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { signOut(); setMobileOpen(false); }} className="min-h-[44px]">
                    {t("nav.signOut")}
                  </Button>
                </>
              )}
              <LanguageSwitcher />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
