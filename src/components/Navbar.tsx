import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { to: "/search", label: "Search" },
  { to: "/membership", label: "Membership" },
  { to: "/host", label: "Host" },
  { to: "/support", label: "Support" },
];

export function Navbar() {
  const { user, signOut, roles } = useAuth();
  const [brandAsset, setBrandAsset] = useState<"wordmark" | "icon" | "text">("wordmark");
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link to="/" className="group flex h-full items-center font-semibold tracking-tight">
          {brandAsset === "text" ? (
            // Last-resort fallback guarantees brand visibility if static assets are unavailable.
            <span className="text-lg">Cheap<span className="text-accent">Stays</span></span>
          ) : (
            <img
              src={brandAsset === "wordmark" ? "/wordmark.png" : "/favicon.png"}
              alt={brandAsset === "wordmark" ? "CheapStays wordmark" : "CheapStays mark"}
              className={`w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02] ${
                brandAsset === "wordmark" ? "h-[90%] max-w-[240px]" : "h-10 max-w-10 rounded-md"
              }`}
              onError={() => {
                // Step down from missing wordmark -> icon -> text fallback to avoid a stale-looking broken header.
                setBrandAsset((current) => (current === "wordmark" ? "icon" : "text"));
              }}
            />
          )}
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
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
                  isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button size="sm" variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
