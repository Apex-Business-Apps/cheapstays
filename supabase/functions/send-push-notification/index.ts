/**
 * Edge function: send-push-notification
 *
 * Required Supabase secrets (set via `supabase secrets set`):
 *   VAPID_PUBLIC_KEY   – base64url-encoded VAPID public key
 *   VAPID_PRIVATE_KEY  – base64url-encoded VAPID private key
 *   VAPID_EMAIL        – contact email, e.g. "mailto:admin@cheapstays.me"
 *
 * Generate keys with:
 *   npx web-push generate-vapid-keys --json
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_EMAIL") ?? "mailto:admin@cheapstays.me",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { user_id, title, body, url } = await req.json() as {
    user_id: string;
    title: string;
    body: string;
    url?: string;
  };

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", user_id);

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = JSON.stringify({ title, body, url: url ?? "/notifications" });
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        );
        sent++;
      } catch (err: unknown) {
        // 404/410 means subscription expired – remove it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
