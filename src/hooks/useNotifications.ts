import { useCallback, useEffect, useMemo, useState } from "react";
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
  const userId = user?.id;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const loadData = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        toast({ title: "Failed to load notifications", description: error.message, variant: "destructive" });
      } else {
        setItems((data as NotificationRow[]) ?? []);
      }
    } catch (err) {
      toast({ title: "Failed to load notifications", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId, items]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (!error) setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Realtime: insert + update
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 50));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setItems((prev) =>
            prev.map((n) => (n.id === (payload.new as NotificationRow).id ? { ...n, ...(payload.new as NotificationRow) } : n)),
          );
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  return { items, loading, unreadCount, markAllRead, markAsRead, refetch: loadData };
}
