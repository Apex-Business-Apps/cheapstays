import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type NotificationRow = { id: string; type: string; title: string; body: string; read: boolean; created_at: string };

export default function Notifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const loadData = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,read,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({ title: "Failed to load notifications", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setItems((data as NotificationRow[]) ?? []);
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!user) {
    return (
      <div className="container py-20 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-2">Sign in to view your notification center.</p>
        <Button asChild className="mt-6">
          <Link to="/auth">Sign in</Link>
        </Button>
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
        <Button variant="outline" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

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
