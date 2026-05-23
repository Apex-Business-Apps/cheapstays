import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PAYMONGO_SIGNATURE_HEADER = "paymongo-signature";

async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [k, v] = segment.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = parts["t"];
  const receivedSig = parts["li"] ?? parts["te"];
  if (!timestamp || !receivedSig) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === receivedSig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();

    // ── Signature verification ───────────────────────────────────────────────
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    if (webhookSecret) {
      const sigHeader = req.headers.get(PAYMONGO_SIGNATURE_HEADER) ?? "";
      if (!(await verifySignature(rawBody, sigHeader, webhookSecret))) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Parse event ──────────────────────────────────────────────────────────
    const event = JSON.parse(rawBody);
    const eventId: string | undefined = event?.data?.id;
    const eventType: string | undefined = event?.data?.attributes?.type;
    const sessionId: string | undefined = event?.data?.attributes?.data?.id;
    const metadata = event?.data?.attributes?.data?.attributes?.metadata;
    const userId: string | undefined = metadata?.user_id;

    if (!eventId || !eventType) {
      return new Response(
        JSON.stringify({ received: true, skipped: "missing event id or type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Idempotency check ────────────────────────────────────────────────────
    const { data: existing } = await adminClient
      .from("webhook_events")
      .select("id")
      .eq("provider", "paymongo")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ received: true, skipped: "duplicate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Handle checkout_session.payment.paid ─────────────────────────────────
    if (eventType === "checkout_session.payment.paid") {
      // Resolve subscription by session id, falling back to user_id + past_due
      let subscription: { id: string; user_id: string } | null = null;

      if (sessionId) {
        const { data } = await adminClient
          .from("membership_subscriptions")
          .select("id, user_id")
          .eq("paymongo_session_id", sessionId)
          .maybeSingle();
        subscription = data ?? null;
      }

      if (!subscription && userId) {
        const { data } = await adminClient
          .from("membership_subscriptions")
          .select("id, user_id")
          .eq("user_id", userId)
          .eq("status", "past_due")
          .maybeSingle();
        subscription = data ?? null;
      }

      if (!subscription) {
        await adminClient.from("webhook_events").insert({
          provider: "paymongo",
          event_id: eventId,
          event_type: eventType,
          booking_id: null,
        });
        return new Response(
          JSON.stringify({ received: true, skipped: "subscription not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Activate the subscription for 30 days
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      const { error: updateErr } = await adminClient
        .from("membership_subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", subscription.id);

      if (updateErr) throw updateErr;

      // Grant member role (use subscription.user_id — authoritative even if metadata was missing)
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .upsert(
          { user_id: subscription.user_id, role: "member", granted_by: null },
          { onConflict: "user_id,role" },
        );

      if (roleErr) throw roleErr;

      // Record the webhook event
      await adminClient.from("webhook_events").insert({
        provider: "paymongo",
        event_id: eventId,
        event_type: eventType,
        booking_id: null,
      });

      return new Response(
        JSON.stringify({ received: true, activated: true, user_id: subscription.user_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Unhandled event types ────────────────────────────────────────────────
    await adminClient.from("webhook_events").insert({
      provider: "paymongo",
      event_id: eventId,
      event_type: eventType,
      booking_id: null,
    });

    return new Response(
      JSON.stringify({ received: true, skipped: "unhandled event type" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
