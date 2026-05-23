import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type NotificationPreferences = {
  email_enabled: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
  booking_updates: boolean;
  payment_updates: boolean;
  verification_updates: boolean;
  host_status_updates: boolean;
  check_in_updates: boolean;
  refund_updates: boolean;
  payout_updates: boolean;
  support_updates: boolean;
  evidence_updates: boolean;
  dispute_updates: boolean;
  safety_critical_updates: boolean;
  marketing_enabled: boolean;
};

const DEFAULTS: NotificationPreferences = {
  email_enabled: true,
  in_app_enabled: true,
  push_enabled: true,
  booking_updates: true,
  payment_updates: true,
  verification_updates: true,
  host_status_updates: true,
  check_in_updates: true,
  refund_updates: true,
  payout_updates: true,
  support_updates: true,
  evidence_updates: true,
  dispute_updates: true,
  safety_critical_updates: true,
  marketing_enabled: false,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setPrefs({ ...DEFAULTS, ...data });
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback(async (patch: Partial<NotificationPreferences>) => {
    if (!userId) return;
    setSaving(true);
    const merged = { ...prefs, ...patch };
    setPrefs(merged);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Failed to save preferences", description: error.message, variant: "destructive" });
      setPrefs(prefs);
    }
    setSaving(false);
  }, [userId, prefs]);

  return { prefs, loading, saving, update };
}
