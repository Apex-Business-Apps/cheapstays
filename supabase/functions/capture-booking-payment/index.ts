/**
 * Edge function: capture-booking-payment
 *
 * Internal — called by pg_cron via pg_net. Requires service_role Authorization.
 *
 * Modes:
 *   "capture"      — For each booking with check_in = today and payment_state = 'authorized',
 *                    call PayMongo capture API and mark the hold as captured.
 *   "reauth_check" — For card_holds expiring within 24 hours (not yet captured or notified),
 *                    email the guest asking them to re-authorize.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function paymongoHeaders(secretKey: string) {
  return {
    Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { mode } = (await req.json()) as { mode: "capture" | "reauth_check" };
  if (mode !== "capture" && mode !== "reauth_check") {
    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY") ?? "";

  // ── Mode: capture ────────────────────────────────────────────────────────────
  if (mode === "capture") {
    const today = new Date().toISOString().slice(0, 10);

    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, paymongo_payment_intent_id, check_in, payment_state")
      .eq("check_in", today)
      .eq("payment_state", "authorized");

    if (bErr) {
      return new Response(JSON.stringify({ error: bErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { booking_id: string; status: string; detail?: string }[] = [];

    for (const booking of bookings ?? []) {
      const { data: hold } = await supabase
        .from("card_holds")
        .select("id, payment_intent_id")
        .eq("booking_id", booking.id)
        .is("captured_at", null)
        .maybeSingle();

      if (!hold) continue;

      // Optimistic lock: mark as 'capturing' so a concurrent run skips this row
      const { count } = await supabase
        .from("bookings")
        .update({ payment_state: "capturing" })
        .eq("id", booking.id)
        .eq("payment_state", "authorized")
        .select("id", { count: "exact", head: true });

      if (!count) {
        // Another instance already grabbed it
        results.push({ booking_id: booking.id, status: "skipped_concurrent" });
        continue;
      }

      const piId = hold.payment_intent_id;
      const captureRes = await fetch(`${PAYMONGO_BASE}/payment_intents/${piId}/capture`, {
        method: "POST",
        headers: paymongoHeaders(paymongoKey),
        body: JSON.stringify({ data: { attributes: {} } }),
      });

      if (captureRes.ok) {
        await supabase
          .from("bookings")
          .update({ payment_status: "paid", payment_state: "captured" })
          .eq("id", booking.id);
        await supabase
          .from("card_holds")
          .update({ captured_at: new Date().toISOString() })
          .eq("id", hold.id);
        results.push({ booking_id: booking.id, status: "captured" });
      } else {
        const detail = await captureRes.text();
        // Revert so the next cron run can retry
        await supabase
          .from("bookings")
          .update({ payment_state: "authorized" })
          .eq("id", booking.id);
        results.push({ booking_id: booking.id, status: "failed", detail });
      }
    }

    return new Response(
      JSON.stringify({ mode, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Mode: reauth_check ───────────────────────────────────────────────────────
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: expiringHolds, error: hErr } = await supabase
    .from("card_holds")
    .select("id, booking_id, expires_at")
    .lt("expires_at", in24h)
    .is("captured_at", null)
    .is("reauth_sent_at", null);

  if (hErr) {
    return new Response(JSON.stringify({ error: hErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let notified = 0;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const siteUrl = Deno.env.get("SITE_URL") ?? supabaseUrl;

  for (const hold of expiringHolds ?? []) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("guest_id, check_in, check_out")
      .eq("id", hold.booking_id)
      .maybeSingle();

    if (!booking) continue;

    const { data: userData } = await supabase.auth.admin.getUserById(booking.guest_id);
    const guestEmail = userData?.user?.email;
    if (!guestEmail) continue;

    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        to: guestEmail,
        subject: "Action required: re-authorize your card hold for your upcoming stay",
        text: [
          `Your card authorization for your stay (check-in: ${booking.check_in}, check-out: ${booking.check_out}) is expiring soon.`,
          "",
          "Please visit your bookings page and re-authorize your card to keep your reservation secure.",
          "",
          `${siteUrl}/my-bookings`,
        ].join("\n"),
      }),
    });

    if (emailRes.ok) {
      await supabase
        .from("card_holds")
        .update({ reauth_sent_at: new Date().toISOString() })
        .eq("id", hold.id);
      notified++;
    }
  }

  return new Response(
    JSON.stringify({ mode, notified }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
