import { supabase } from "@/integrations/supabase/client";
import { splitEarnings } from "@/lib/money";

export type StuckRow = {
  bookingId: string;
  hostName: string;
  gross: number;
  host: number;
  payoutReleaseOn: string;
  daysOverdue: number;
  reason: "no_credit" | "not_released";
};

const STUCK_WINDOW_DAYS = 3;

export async function loadWalletHealth(): Promise<StuckRow[]> {
  const cutoff = new Date(Date.now() - STUCK_WINDOW_DAYS * 86_400_000).toISOString();

  const bookRes = await supabase
    .from("bookings")
    .select("id,host_id,total_php,payout_release_on")
    .eq("payment_status", "paid")
    .lt("payout_release_on", cutoff)
    .order("payout_release_on", { ascending: true })
    .limit(500);

  const bookings = (bookRes.data ?? []) as unknown as Array<{
    id: string; host_id: string; total_php: number | string; payout_release_on: string;
  }>;
  if (bookings.length === 0) return [];

  const bookingIds = bookings.map((b) => b.id);
  const hostIds = Array.from(new Set(bookings.map((b) => b.host_id)));

  const [txRes, profRes] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select("booking_id,type,status")
      .in("booking_id", bookingIds)
      .eq("status", "completed"),
    supabase.from("profiles").select("user_id,display_name").in("user_id", hostIds),
  ]);

  const stageMap = new Map<string, "credited" | "released">();
  for (const t of txRes.data ?? []) {
    if (!t.booking_id) continue;
    if (t.type === "release_to_available") stageMap.set(t.booking_id, "released");
    else if (t.type === "credit_pending" && stageMap.get(t.booking_id) !== "released") {
      stageMap.set(t.booking_id, "credited");
    }
  }

  const nameMap = new Map<string, string>();
  for (const p of profRes.data ?? []) if (p.display_name) nameMap.set(p.user_id, p.display_name);

  const now = Date.now();
  return bookings
    .filter((b) => stageMap.get(b.id) !== "released")
    .map((b) => {
      const gross = Number(b.total_php ?? 0);
      const { host } = splitEarnings(gross);
      const stage = stageMap.get(b.id);
      return {
        bookingId: b.id,
        hostName: nameMap.get(b.host_id) ?? `Host #${b.host_id.slice(0, 6)}`,
        gross,
        host,
        payoutReleaseOn: b.payout_release_on,
        daysOverdue: Math.floor((now - new Date(b.payout_release_on).getTime()) / 86_400_000),
        reason: stage === "credited" ? "not_released" : "no_credit",
      };
    });
}
