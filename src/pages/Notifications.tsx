import { Component, type ReactNode } from "react";
import { Bell, BellOff, BellRing, BookCheck, Calendar, CheckCheck, Info, Star } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";

function typeIcon(type: string) {
  switch (type) {
    case "booking_status": return <BookCheck className="h-4 w-4 text-primary shrink-0" />;
    case "review":         return <Star className="h-4 w-4 text-yellow-500 shrink-0" />;
    case "calendar":       return <Calendar className="h-4 w-4 text-blue-500 shrink-0" />;
    default:               return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PushSection() {
  const { supported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(false);

  if (!supported) {
    return (
      <Card className="p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Push notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!("Notification" in window)
              ? "Your browser does not support push notifications."
              : !import.meta.env.VITE_VAPID_PUBLIC_KEY
              ? "Push notifications require VAPID keys. Set VITE_VAPID_PUBLIC_KEY in your environment."
              : "Push notifications are not available in this environment."}
          </p>
        </div>
      </Card>
    );
  }

  if (permission === "denied") {
    return (
      <Card className="p-4 flex items-start gap-3 border-destructive/40">
        <BellOff className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Push notifications blocked</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You&apos;ve blocked notifications for this site. To enable them, update your browser&apos;s site
            permissions and refresh the page.
          </p>
        </div>
      </Card>
    );
  }

  async function toggle() {
    setLoading(true);
    if (isSubscribed) {
      await unsubscribe();
      toast({ title: "Push notifications disabled" });
    } else {
      const ok = await subscribe();
      if (ok) toast({ title: "Push notifications enabled" });
      else toast({ title: "Could not enable push notifications", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <Card className="p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        {isSubscribed
          ? <BellRing className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          : <Bell className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
        <div>
          <p className="text-sm font-medium">
            Push notifications&nbsp;
            <Badge variant={isSubscribed ? "default" : "outline"} className="text-[10px] px-1.5 py-0 ml-1 align-middle">
              {isSubscribed ? "On" : "Off"}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSubscribed
              ? "You'll receive browser push notifications for booking updates."
              : "Enable to receive booking updates even when the tab is closed."}
          </p>
        </div>
      </div>
      <Button variant={isSubscribed ? "outline" : "default"} size="sm" onClick={toggle} disabled={loading}>
        {loading ? "…" : isSubscribed ? "Disable" : "Enable"}
      </Button>
    </Card>
  );
}

/** Silent error boundary — hides PushSection if it throws rather than crashing the page. */
class PushSectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default function Notifications() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const { items, loading, unreadCount, markAllRead, markAsRead } = useNotifications();
  const [tab, setTab] = useState<"all" | "unread">("all");

  // Hold render while we measure the viewport — prevents a flash of the desktop
  // page on mobile/tablet before the redirect fires.
  if (isDesktop === undefined) {
    return null;
  }

  // Redirect mobile AND tablet users — they access notifications via the bell
  // icon modal in the Navbar (NotificationsModal), not this page.
  if (!isDesktop) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return (
      <div className="container py-20 max-w-md text-center">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-2">Sign in to view your notification center.</p>
        <Button asChild className="mt-6">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  const displayed = tab === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <div className="container py-10 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Push notification control — isolated so any browser-specific failure doesn't crash the page */}
      <PushSectionBoundary>
        <PushSection />
      </PushSectionBoundary>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-2">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {t === "all" ? "All" : (
              <span className="flex items-center gap-1.5">
                Unread
                {unreadCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {tab === "unread" ? "No unread notifications." : "No notifications yet."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {displayed.map((n) => (
              <li
                key={n.id}
                className={`px-5 py-4 flex items-start gap-4 transition-colors hover:bg-secondary/20 cursor-pointer ${!n.read ? "bg-secondary/10" : ""}`}
                onClick={() => { if (!n.read) void markAsRead(n.id); }}
              >
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
