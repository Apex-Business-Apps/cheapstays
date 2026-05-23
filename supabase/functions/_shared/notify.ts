/**
 * Shared notification dispatcher.
 * Respects user preferences, sends in-app + push (high-value) + email (if Resend key set).
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const TYPE_TO_CATEGORY_PREF: Record<string, string> = {
  booking_status_changed: "booking_updates",
  payment_failed: "payment_updates",
  verification_required: "verification_updates",
  host_status_approved: "host_status_updates",
  check_in_access_shared: "check_in_updates",
  refund_processed: "refund_updates",
  payout_released: "payout_updates",
  support_ticket_updated: "support_updates",
  evidence_requested: "evidence_updates",
  dispute_status_changed: "dispute_updates",
  safety_admin_action: "safety_critical_updates",
};

// Push only fires for high-value events — booking changes, payment failures,
// check-in access, host approval, support escalation, urgent safety/admin action.
const PUSH_HIGH_VALUE = new Set([
  "booking_status_changed",
  "payment_failed",
  "host_status_approved",
  "check_in_access_shared",
  "support_ticket_updated",
  "safety_admin_action",
]);

export interface DispatchParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  url?: string;
}

export async function dispatchNotification(
  adminClient: SupabaseClient,
  params: DispatchParams,
): Promise<void> {
  const { userId, type, title, body, data = {}, url = "/notifications" } = params;

  // Load user preferences; missing row → all defaults apply
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefs } = await (adminClient as any)
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const categoryPrefKey = TYPE_TO_CATEGORY_PREF[type] ?? null;
  const categoryEnabled = !categoryPrefKey || ((prefs?.[categoryPrefKey] as boolean) ?? true);
  if (!categoryEnabled) return;

  // ── In-app ───────────────────────────────────────────────────────────────
  const inAppEnabled: boolean = prefs?.in_app_enabled ?? true;
  if (inAppEnabled) {
    await adminClient.from("notifications").insert({ user_id: userId, type, title, body, data });
  }

  // ── Push (high-value only) ────────────────────────────────────────────────
  const pushEnabled: boolean = (prefs?.push_enabled ?? true) && PUSH_HIGH_VALUE.has(type);
  if (pushEnabled) {
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(
        Deno.env.get("VAPID_EMAIL") ?? "mailto:cheapstays.me@gmail.com",
        vapidPublic,
        vapidPrivate,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subs } = await (adminClient as any)
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_key")
        .eq("user_id", userId);

      if (subs?.length) {
        const payload = JSON.stringify({ title, body, url });
        await Promise.all(
          (subs as { endpoint: string; p256dh: string; auth_key: string }[]).map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
                payload,
              );
            } catch (err: unknown) {
              const status = (err as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (adminClient as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
            }
          }),
        );
      }
    }
  }

  // ── Email (graceful no-op if RESEND_API_KEY not configured) ──────────────
  const emailEnabled: boolean = prefs?.email_enabled ?? true;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (emailEnabled && resendKey) {
    // Look up user's email from auth.users via admin client RPC or profiles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (adminClient as any).auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (email) {
      await sendResendEmail({ to: email, subject: title, text: body, resendKey });
    }
  }
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  resendKey: string;
}) {
  const { to, subject, text, resendKey } = opts;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CheapStays <cheapstays.me@gmail.com>",
        to: [to],
        subject,
        text,
      }),
    });
  } catch {
    // Email failures are non-fatal — in-app and push already sent
  }
}
