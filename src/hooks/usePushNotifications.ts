import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        setReg(r);
        return r.pushManager.getSubscription();
      })
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {});
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!reg || !user || !VAPID_PUBLIC_KEY) return false;
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") return false;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      // push_subscriptions is a new table not in generated types – cast required
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth_key: json.keys!.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "user_id,endpoint" },
      );

      setIsSubscribed(true);
      return true;
    } catch {
      return false;
    }
  }, [reg, user]);

  const unsubscribe = useCallback(async () => {
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
    setIsSubscribed(false);
  }, [reg]);

  return { supported, permission, isSubscribed, subscribe, unsubscribe };
}
