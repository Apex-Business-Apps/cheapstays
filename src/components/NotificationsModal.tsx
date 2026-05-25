import {
  AlertTriangle,
  Bell,
  BellRing,
  BookCheck,
  Calendar,
  CheckCheck,
  CreditCard,
  FileWarning,
  Home,
  Key,
  MessageSquare,
  RefreshCw,
  Siren,
  Star,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";

function typeIcon(type: string) {
  switch (type) {
    case "booking_status":
    case "booking_status_changed":  return <BookCheck className="h-4 w-4 text-primary shrink-0" />;
    case "payment_failed":          return <CreditCard className="h-4 w-4 text-destructive shrink-0" />;
    case "host_status_approved":    return <Home className="h-4 w-4 text-green-500 shrink-0" />;
    case "check_in_access_shared":  return <Key className="h-4 w-4 text-blue-500 shrink-0" />;
    case "refund_processed":        return <RefreshCw className="h-4 w-4 text-cyan-500 shrink-0" />;
    case "payout_released":         return <Wallet className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "support_ticket_updated":  return <MessageSquare className="h-4 w-4 text-violet-500 shrink-0" />;
    case "evidence_requested":      return <FileWarning className="h-4 w-4 text-orange-500 shrink-0" />;
    case "dispute_status_changed":  return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "safety_admin_action":     return <Siren className="h-4 w-4 text-destructive shrink-0" />;
    case "review":                  return <Star className="h-4 w-4 text-yellow-500 shrink-0" />;
    case "calendar":                return <Calendar className="h-4 w-4 text-blue-500 shrink-0" />;
    default:                        return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
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

export function NotificationsModal() {
  const { user } = useAuth();
  const { items, loading, unreadCount, markAllRead, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const displayed = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
          className="relative block lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="flex gap-1 mt-2">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs rounded-full px-3 py-1 transition-colors capitalize ${filter === f ? "bg-secondary text-secondary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === "unread" && unreadCount > 0 ? (
                  <>{f} <span className="ml-1 text-destructive font-semibold">{unreadCount}</span></>
                ) : f}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16 px-6 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Sign in to view your notifications.</p>
              <Button size="sm" asChild onClick={() => setOpen(false)}>
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {filter === "unread" ? "No unread notifications." : "No notifications yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {displayed.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-secondary/30 ${!n.read ? "bg-secondary/20" : ""}`}
                  onClick={() => { if (!n.read) void markAsRead(n.id); }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{typeIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {user && (
          <div className="px-4 py-3 border-t border-border/60 text-center">
            <Link
              to="/notifications"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              Manage preferences →
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
