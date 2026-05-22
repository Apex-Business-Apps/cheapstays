import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type NotificationRow = { id: string; type: string; title: string; body: string; read: boolean; created_at: string };
type NotificationPreference = { key: string; channel: string; enabled: boolean };

export default function Notifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [itemsRes, prefsRes] = await Promise.all([
      supabase.from("notifications").select("id,type,title,body,read,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("notification_preferences").select("key,channel,enabled").order("key", { ascending: true }),
    ]);
    if (itemsRes.error || prefsRes.error) {
      toast({ title: "Failed to load notifications", description: itemsRes.error?.message ?? prefsRes.error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setItems((itemsRes.data as NotificationRow[]) ?? []);
    setPrefs((prefsRes.data as NotificationPreference[]) ?? []);
    setLoading(false);
  }, [user]);

  async function markAllRead() {
    if (!user) return;
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    setItems((current) => current.map((n) => ({ ...n, read: true })));
  }

  async function togglePreference(pref: NotificationPreference) {
    const nextEnabled = !pref.enabled;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user?.id, key: pref.key, channel: pref.channel, enabled: nextEnabled }, { onConflict: "user_id,key,channel" });
    if (error) {
      toast({ title: "Failed to save preference", description: error.message, variant: "destructive" });
      return;
    }
    setPrefs((current) => current.map((p) => (p.key === pref.key && p.channel === pref.channel ? { ...p, enabled: nextEnabled } : p)));
  }

  useEffect(() => { void loadData(); }, [loadData]);

  if (!user) {
    return (
      <div className="container py-20 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-2">Sign in to view your notification center.</p>
        <Button asChild className="mt-6"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Unread: {unreadCount}</p>
        </div>
        <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Delivery preferences</h2>
        {prefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom preferences yet.</p>
        ) : prefs.map((pref) => (
          <div key={`${pref.key}-${pref.channel}`} className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <Label className="font-medium">{pref.key}</Label>
              <p className="text-xs text-muted-foreground">Channel: {pref.channel}</p>
            </div>
            <Switch checked={pref.enabled} onCheckedChange={() => togglePreference(pref)} />
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Recent events</h2>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-muted-foreground">No notifications yet.</p> : null}
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className={`border rounded-md p-3 ${n.read ? "bg-background" : "bg-secondary/40"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{n.title}</p>
                <Badge variant={n.read ? "outline" : "secondary"}>{n.read ? "Read" : "Unread"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
