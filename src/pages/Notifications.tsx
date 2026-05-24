import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  BookCheck,
  Calendar,
  CheckCheck,
  CreditCard,
  FileWarning,
  Home,
  Info,
  Key,
  Mail,
  MessageSquare,
  RefreshCw,
  Shield,
  Siren,
  Star,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";

function typeIcon(type: string) {
  switch (type) {
    case "booking_status":
    case "booking_status_changed":  return <BookCheck className="h-4 w-4 text-primary shrink-0" />;
    case "payment_failed":          return <CreditCard className="h-4 w-4 text-destructive shrink-0" />;
    case "verification_required":   return <Shield className="h-4 w-4 text-yellow-500 shrink-0" />;
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
            You&apos;ve blocked notifications for this site. Update your browser&apos;s site permissions and refresh.
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
              ? "High-value events (booking changes, payment failures, check-in) will send browser alerts."
              : "Enable to get booking updates even when the tab is closed. Only used for high-value events."}
          </p>
        </div>
      </div>
      <Button variant={isSubscribed ? "outline" : "default"} size="sm" onClick={toggle} disabled={loading}>
        {loading ? "…" : isSubscribed ? "Disable" : "Enable"}
      </Button>
    </Card>
  );
}

type PrefToggleProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
};

function PrefToggle({ id, label, description, checked, disabled, onCheckedChange }: PrefToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function PreferencesSection() {
  const { prefs, loading, saving, update } = useNotificationPreferences();

  if (loading) return <div className="h-8 flex items-center text-sm text-muted-foreground">Loading preferences…</div>;

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Notification channels</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how you receive notifications.</p>
      </div>

      <div className="space-y-1">
        <PrefToggle
          id="pref-email"
          label="Email"
          description="Sent to your account email address"
          checked={prefs.email_enabled}
          disabled={saving}
          onCheckedChange={(v) => update({ email_enabled: v })}
        />
        <PrefToggle
          id="pref-inapp"
          label="In-app"
          description="Appears in this notification center"
          checked={prefs.in_app_enabled}
          disabled={saving}
          onCheckedChange={(v) => update({ in_app_enabled: v })}
        />
        <PrefToggle
          id="pref-push"
          label="Push"
          description="Browser push — high-value events only (booking, payment, check-in)"
          checked={prefs.push_enabled}
          disabled={saving}
          onCheckedChange={(v) => update({ push_enabled: v })}
        />
      </div>

      <Separator />

      <div>
        <h2 className="text-sm font-semibold">Topics</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Turn off topics you don&apos;t need.</p>
      </div>

      <div className="space-y-1">
        <PrefToggle id="pref-booking" label="Booking updates" checked={prefs.booking_updates} disabled={saving} onCheckedChange={(v) => update({ booking_updates: v })} />
        <PrefToggle id="pref-payment" label="Payment &amp; refunds" checked={prefs.payment_updates} disabled={saving} onCheckedChange={(v) => update({ payment_updates: v })} />
        <PrefToggle id="pref-verify" label="Verification" checked={prefs.verification_updates} disabled={saving} onCheckedChange={(v) => update({ verification_updates: v })} />
        <PrefToggle id="pref-host" label="Host status" checked={prefs.host_status_updates} disabled={saving} onCheckedChange={(v) => update({ host_status_updates: v })} />
        <PrefToggle id="pref-checkin" label="Check-in &amp; access" checked={prefs.check_in_updates} disabled={saving} onCheckedChange={(v) => update({ check_in_updates: v })} />
        <PrefToggle id="pref-refund" label="Refunds" checked={prefs.refund_updates} disabled={saving} onCheckedChange={(v) => update({ refund_updates: v })} />
        <PrefToggle id="pref-payout" label="Payouts" checked={prefs.payout_updates} disabled={saving} onCheckedChange={(v) => update({ payout_updates: v })} />
        <PrefToggle id="pref-support" label="Support tickets" checked={prefs.support_updates} disabled={saving} onCheckedChange={(v) => update({ support_updates: v })} />
        <PrefToggle id="pref-evidence" label="Evidence requests" checked={prefs.evidence_updates} disabled={saving} onCheckedChange={(v) => update({ evidence_updates: v })} />
        <PrefToggle id="pref-dispute" label="Dispute updates" checked={prefs.dispute_updates} disabled={saving} onCheckedChange={(v) => update({ dispute_updates: v })} />
        <PrefToggle
          id="pref-safety"
          label="Safety &amp; admin alerts"
          description="Always-on for critical platform safety events"
          checked={prefs.safety_critical_updates}
          disabled={saving}
          onCheckedChange={(v) => update({ safety_critical_updates: v })}
        />
        <PrefToggle id="pref-marketing" label="Marketing &amp; promotions" checked={prefs.marketing_enabled} disabled={saving} onCheckedChange={(v) => update({ marketing_enabled: v })} />
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="animate-spin inline-block h-3 w-3 border border-current border-t-transparent rounded-full" />
          Saving…
        </p>
      )}
    </Card>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { items, loading, unreadCount, markAllRead, markAsRead } = useNotifications();
  const [tab, setTab] = useState<"all" | "unread" | "settings">("all");

  // Mobile/tablet: redirect to home — they use the NotificationsModal sheet
  if (isMobile) return <Navigate to="/" replace />;

  if (!user) {
    return (
      <div className="container py-20 max-w-md text-center">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-2">Sign in to view your notification center.</p>
        <Button asChild className="mt-6"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && tab !== "settings" && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread" | "settings")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {(["all", "unread"] as const).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue}>
            <Card className="overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (tabValue === "unread" ? items.filter((n) => !n.read) : items).length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {tabValue === "unread" ? "No unread notifications." : "No notifications yet."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {(tabValue === "unread" ? items.filter((n) => !n.read) : items).map((n) => (
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
          </TabsContent>
        ))}

        <TabsContent value="settings">
          <div className="space-y-4">
            <PushSection />
            <PreferencesSection />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
