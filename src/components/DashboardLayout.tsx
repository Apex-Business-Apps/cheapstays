// src/components/DashboardLayout.tsx
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isHost, isAdmin } from "@/lib/rbac";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationsModal } from "@/components/NotificationsModal";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  requiredRole?: "host" | "admin";
}

export function DashboardLayout({ requiredRole }: Props) {
  const { user, roles, loading, signOut } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?mode=signin&next=${encodeURIComponent(pathname)}`} replace />;
  }

  if (requiredRole === "admin" && !isAdmin(roles)) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === "host" && !isHost(roles)) {
    return <Navigate to="/host/apply" replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px]" />
          <Link to="/" className="flex items-center">
            <img
              src={`/wordmark.png?v=${__CACHE_BUST__}`}
              alt="CheapStays"
              className="h-7 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `/favicon.png?v=${__CACHE_BUST__}`;
              }}
            />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsModal />
            <LanguageSwitcher />
            <ThemeToggle />
            <Button size="sm" variant="ghost" onClick={signOut} className="hidden sm:flex min-h-[44px] min-w-[44px]">
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
