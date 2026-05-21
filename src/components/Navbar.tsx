import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles } from "lucide-react";

const links = [
  { to: "/search", label: "Search" },
  { to: "/membership", label: "Membership" },
  { to: "/host", label: "Host" },
  { to: "/support", label: "Support" },
];

export function Navbar() {
  const { user, signOut, roles } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>cheapstays<span className="text-accent">.me</span></span>
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
