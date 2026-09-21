import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
});

const RESEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CHECKOUT_GATE_MS   = 1 * 24 * 60 * 60 * 1000; // 1 day after checkout
const EXPIRY_DAYS = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomToken(): string {
  // 32 url-safe chars.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendReviewEmail(opts: {
  to: string;
  guestName: string | null;
  listingTitle: string;
  checkOut: string;
  reviewUrl: string;
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { sent: false, reason: "no_key" };
  const nameLine = opts.guestName ? `Hi ${opts.guestName},` : "Hi there,";
  const checkOutFmt = new Date(opts.checkOut).toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1a1a1a;max-width:520px">
      <h2 style="margin-top:0">How was your stay?</h2>
      <p>${nameLine}</p>
      <p>Thanks for staying at <strong>${opts.listingTitle}</strong>. Your host asked if you could leave a quick review of the stay — takes under a minute and helps future guests.</p>
      <p style="margin:24px 0">
        <a href="${opts.reviewUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Leave a review</a>
      </p>
      <p style="color:#666;font-size:13px">Check-out: ${checkOutFmt}. This link is valid for ${EXPIRY_DAYS} days.</p>
      <p style="color:#999;font-size:11px">If the button doesn't work, paste this URL in your browser:<br>${opts.reviewUrl}</p>
    </div>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CheapStays <no-reply@cheapstays.me>",
      to: [opts.to],
      subject: `How was your stay at ${opts.listingTitle}?`,
      html,
    }),
  });
  return { sent: res.ok, reason: res.ok ? null : `resend_${res.status}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

    const rl = await rateLimit(`send-guest-review-request:${user.id}`, 30, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    let body: unknown;
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking, error: bkErr } = await admin
      .from("bookings")
      .select("id, host_id, guest_id, listing_id, check_out, status, stay_type, guest_name_snapshot")
      .eq("id", parsed.data.booking_id)
      .maybeSingle();

    if (bkErr) {
      console.error("bookings query failed:", bkErr);
      return json({ error: `Booking lookup failed: ${bkErr.message}` }, 500);
    }
    if (!booking) return json({ error: "Booking not found" }, 404);
    if (booking.host_id !== user.id) return json({ error: "You are not the host of this booking" }, 403);
    if (booking.status === "cancelled") {
      return json({ error: "Cancelled bookings can't be reviewed" }, 400);
    }

    const checkoutMs = new Date(booking.check_out).getTime();
    if (Number.isNaN(checkoutMs)) return json({ error: "Booking has no check-out date" }, 400);
    if (Date.now() < checkoutMs + CHECKOUT_GATE_MS) {
      return json({ error: "Review requests unlock 1 day after check-out" }, 400);
    }

    // Resolve guest contact — two paths: registered guest (auth.users) or
    // anonymous voucher buyer (stay_voucher_purchases).
    let guestEmail: string | null = null;
    let guestName: string | null = null;

    if (booking.guest_id) {
      const { data: userData, error: authGetErr } = await admin.auth.admin.getUserById(booking.guest_id);
      if (authGetErr) {
        console.error("auth.admin.getUserById failed:", authGetErr);
        return json({ error: `Guest lookup failed: ${authGetErr.message}` }, 500);
      }
      guestEmail = userData?.user?.email ?? null;

      const { data: profile } = await admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", booking.guest_id)
        .maybeSingle();
      guestName = (profile as { display_name: string | null } | null)?.display_name ?? null;
    } else if (booking.stay_type === "voucher") {
      // Voucher path: stay_voucher_codes.booking_id → purchase → buyer email/name.
      const { data: code } = await admin
        .from("stay_voucher_codes")
        .select("purchase_id")
        .eq("booking_id", booking.id)
        .maybeSingle();
      const purchaseId = (code as { purchase_id: string | null } | null)?.purchase_id ?? null;
      if (!purchaseId) return json({ error: "Voucher purchase not found for this booking" }, 400);

      const { data: purchase } = await admin
        .from("stay_voucher_purchases")
        .select("buyer_email, buyer_name")
        .eq("id", purchaseId)
        .maybeSingle();
      const p = purchase as { buyer_email: string | null; buyer_name: string | null } | null;
      guestEmail = p?.buyer_email ?? null;
      guestName = p?.buyer_name ?? booking.guest_name_snapshot ?? null;
    }

    if (!guestEmail) return json({ error: "Guest has no email on file" }, 400);
    if (!guestName) guestName = booking.guest_name_snapshot ?? null;

    const { data: listing } = await admin
      .from("listings")
      .select("title")
      .eq("id", booking.listing_id)
      .maybeSingle();
    const listingTitle = (listing as { title: string } | null)?.title ?? "your stay";

    // Existing request?
    const { data: existing } = await admin
      .from("review_requests")
      .select("id, token, resend_count, last_sent_at, submitted_review_id")
      .eq("booking_id", booking.id)
      .maybeSingle();

    let token: string;
    if (existing) {
      if (existing.submitted_review_id) {
        return json({ error: "Guest already left a review" }, 400);
      }
      const lastMs = new Date(existing.last_sent_at as string).getTime();
      if (Date.now() - lastMs < RESEND_COOLDOWN_MS) {
        const nextInMs = RESEND_COOLDOWN_MS - (Date.now() - lastMs);
        const days = Math.ceil(nextInMs / (24 * 60 * 60 * 1000));
        return json({ error: `Please wait ${days} day${days === 1 ? "" : "s"} before resending` }, 429);
      }
      token = existing.token as string;
      const { error: updErr } = await admin
        .from("review_requests")
        .update({
          last_sent_at: new Date().toISOString(),
          resend_count: (existing.resend_count as number) + 1,
          guest_email: guestEmail,
          expires_at: new Date(Date.now() + EXPIRY_DAYS * 86_400_000).toISOString(),
        })
        .eq("id", existing.id);
      if (updErr) throw updErr;
    } else {
      token = randomToken();
      const { error: insErr } = await admin.from("review_requests").insert({
        booking_id: booking.id,
        token,
        host_id: booking.host_id,
        guest_id: booking.guest_id ?? null,
        guest_name_snapshot: booking.guest_id ? null : guestName,
        listing_id: booking.listing_id,
        guest_email: guestEmail,
      });
      if (insErr) throw insErr;
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://cheapstays.me";
    const reviewUrl = `${siteUrl.replace(/\/$/, "")}/review/${token}`;

    // Fire-and-log email send.
    let emailResult: { sent: boolean; reason: string | null } = { sent: false, reason: "no_key" };
    try {
      emailResult = await sendReviewEmail({
        to: guestEmail,
        guestName,
        listingTitle,
        checkOut: booking.check_out,
        reviewUrl,
      });
    } catch (err) {
      console.error("review email send failed:", err);
      emailResult = { sent: false, reason: (err as Error).message };
    }

    return json({
      success: true,
      resent: !!existing,
      email_sent: emailResult.sent,
      email_reason: emailResult.reason,
      review_url: reviewUrl,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
