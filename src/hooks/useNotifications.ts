import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Unique per hook instance — prevents duplicate-subscribe throw when the hook is mounted
  // in both NotificationsModal (Navbar) and the Notifications page simultaneously.
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const loadData = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,read,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Failed to load notifications", description: error.message, variant: "destructive" });
    } else {
      setItems((data as NotificationRow[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user, items]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (!error) setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Realtime: insert + update
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}:${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 50));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((prev) =>
            prev.map((n) => (n.id === (payload.new as NotificationRow).id ? { ...n, ...(payload.new as NotificationRow) } : n)),
          );
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  return { items, loading, unreadCount, markAllRead, markAsRead, refetch: loadData };
}
