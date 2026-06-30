/**
 * Edge function: guest-book-listing
 *
 * One-shot guest checkout — book WITHOUT first creating an account.
 *
 * Flow (all server-side, service role):
 *   1. Validate the listing + selection (mirrors book-listing rules).
 *   2. Find-or-create an auth account for the guest's email.
 *        - new email   → create a confirmed account (no password)
 *        - existing email → attach the booking to that account
 *      (bookings.guest_id is NOT NULL → a booking must own a real auth user.)
 *   3. Insert the booking (instant-book overnight + hourly only).
 *   4. Open a PayMongo hosted checkout session and persist it.
 *   5. Email the guest a booking summary + a magic sign-in link.
 *
 * Payment is finalised by the existing payment-webhook.
 *
 * No Bearer auth required — this is the public guest path.
 *
 * Required Supabase secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PAYMONGO_SECRET_KEY   – PayMongo secret key
 *   SITE_URL              – e.g. https://cheapstays.me
 *   RESEND_API_KEY        – (optional) email; graceful no-op if missing
 */
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const SHORT_TERM_MAX_NIGHTS = 30;
const PAYMONGO_BASE = "https://api.paymongo.com/v1";

const BodySchema = z.object({
  listing_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  guests: z.number().int().min(1).max(20),
  guest_message: z.string().max(1000).optional(),
  stay_type: z.enum(["overnight", "hourly"]).optional().default("overnight"),
  arrival_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  duration_hours: z.number().int().optional(),
  payment_method: z.enum(["gcash", "maya", "card"]).default("gcash"),
  contact: z.object({
    full_name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    phone: z.string().max(40).optional(),
  }),
});

function dateDiffDays(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pmHeaders(key: string, idempotencyKey: string) {
  return {
    Authorization: `Basic ${btoa(`${key}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`guest-book-listing:${ip}`, 5, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const {
      listing_id, check_in, check_out, guests, guest_message,
      stay_type, arrival_time, duration_hours, payment_method, contact,
    } = parsed.data;

    const email = contact.email.trim().toLowerCase();

    // A second, tighter limit keyed on the email curbs enumeration / spam.
    const rlEmail = await rateLimit(`guest-book-listing:email:${email}`, 5, 300_000);
    if (!rlEmail.ok) return json({ error: "Too many attempts. Please try again later." }, 429);

    if (check_out <= check_in) {
      return json({ error: "check_out must be after check_in" }, 400);
    }

    const nights = dateDiffDays(check_in, check_out);
    if (stay_type === "overnight" && nights < 1) {
      return json({ error: "Stay must be at least 1 night" }, 400);
    }
    if (stay_type === "hourly" && nights !== 1) {
      return json({ error: "Hourly check_out must be check_in + 1 day" }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: listing, error: listingError } = await adminClient
      .from("listings")
      .select(
        "id, title, city, host_id, nightly_php, max_guests, min_nights, max_nights, " +
        "short_term_enabled, long_term_enabled, status, " +
        "stay_availability_type, booking_mode, hourly_php, price_3h, price_6h, price_12h",
      )
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) return json({ error: "Listing not found" }, 404);

    if (listing.status !== "active") {
      return json({ error: "Listing is not available for booking" }, 409);
    }
    if (listing.booking_mode === "voucher") {
      return json({ error: "Voucher listings cannot be booked directly. Please purchase a voucher." }, 400);
    }
    if (stay_type === "hourly" && listing.stay_availability_type === "overnight") {
      return json({ error: "This listing does not support hourly stays." }, 400);
    }
    if (stay_type === "overnight" && listing.stay_availability_type === "hourly") {
      return json({ error: "This listing does not support overnight stays." }, 400);
    }
    if (guests > listing.max_guests) {
      return json({ error: `Too many guests. Maximum allowed: ${listing.max_guests}` }, 400);
    }
    if (stay_type === "overnight" && nights < listing.min_nights) {
      return json({ error: `Minimum stay is ${listing.min_nights} night(s). Requested: ${nights}` }, 400);
    }
    if (stay_type === "overnight" && listing.max_nights && nights > listing.max_nights) {
      return json({ error: `Maximum stay is ${listing.max_nights} night(s). Requested: ${nights}` }, 400);
    }

    const isShortTermStay = nights <= SHORT_TERM_MAX_NIGHTS;
    const isLongTermStay = nights > SHORT_TERM_MAX_NIGHTS;

    if (stay_type === "overnight" && isShortTermStay && listing.short_term_enabled === false) {
      return json({ error: "This listing does not accept short-term stays (≤30 nights)" }, 400);
    }
    if (stay_type === "overnight" && isLongTermStay && listing.long_term_enabled !== true) {
      return json({ error: "This listing does not accept long-term stays (31+ nights)" }, 400);
    }

    // Guest checkout is instant-only: long-term overnight stays route to a host
    // request that needs an account to manage, so block them here.
    if (stay_type === "overnight" && isLongTermStay) {
      return json({
        error: "Guest checkout supports instant bookings only. Please create an account to send a long-term booking request.",
      }, 400);
    }

    // Pricing + total
    let subtotal = 0;
    if (stay_type === "overnight") {
      subtotal = nights * listing.nightly_php;
    } else {
      if (duration_hours === 3 && listing.price_3h) subtotal = listing.price_3h;
      else if (duration_hours === 6 && listing.price_6h) subtotal = listing.price_6h;
      else if (duration_hours === 12 && listing.price_12h) subtotal = listing.price_12h;
      else return json({ error: "Hourly pricing is not configured for this duration (must be 3, 6, or 12)" }, 400);
    }
    const serviceFee = Math.round(subtotal * 0.05);
    const totalPhp = subtotal + serviceFee;

    // ── Find-or-create the guest account ──
    // bookings.guest_id is NOT NULL, so the booking must own a real auth user.
    let accountCreated = false;
    const { error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: contact.full_name.trim(),
        phone: contact.phone ?? null,
        created_via: "guest_checkout",
      },
    });

    if (createErr) {
      // 422 / "already registered" → existing account, attach to it (intended).
      const status = (createErr as { status?: number }).status;
      const alreadyExists = status === 422 || /already|registered|exists/i.test(createErr.message);
      if (!alreadyExists) {
        console.error("createUser error:", createErr);
        return json({ error: "Could not set up your account", detail: createErr.message }, 500);
      }
    } else {
      accountCreated = true;
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://cheapstays.me";

    // generateLink resolves the user id (new or existing) AND produces the magic
    // sign-in link we email them — no plaintext password is ever sent.
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${siteUrl}/my-bookings` },
    });
    if (linkErr || !linkData?.user?.id) {
      console.error("generateLink error:", linkErr);
      return json({ error: "Could not set up your account", detail: linkErr?.message }, 500);
    }
    const guestUserId = linkData.user.id;
    const actionLink = linkData.properties?.action_link ?? `${siteUrl}/auth`;

    if (listing.host_id === guestUserId) {
      return json({ error: "You cannot book your own listing" }, 403);
    }

    // ── Hourly slot + overlap protection ──
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    if (stay_type === "hourly" && arrival_time && duration_hours) {
      startsAt = `${check_in}T${arrival_time}:00Z`;
      const dateObj = new Date(startsAt);
      dateObj.setHours(dateObj.getHours() + duration_hours);
      endsAt = dateObj.toISOString();

      const { data: overlapping, error: overlapError } = await adminClient
        .from("bookings")
        .select("id")
        .eq("listing_id", listing_id)
        .in("status", ["pending", "confirmed"])
        .lt("starts_at", endsAt)
        .gt("ends_at", startsAt)
        .limit(1);
      if (overlapError) {
        console.error("Overlap check error:", overlapError);
        return json({ error: "Failed to verify listing availability" }, 500);
      }
      if (overlapping && overlapping.length > 0) {
        return json({ error: "This time slot overlaps with an existing booking" }, 409);
      }
    }

    // ── Insert booking ──
    const payload: Record<string, string | number | boolean | null | undefined> = {
      listing_id,
      guest_id: guestUserId,
      host_id: listing.host_id,
      check_in,
      check_out,
      nights,
      guests,
      guest_message,
      total_php: totalPhp,
      status: "pending",
      payment_status: "unpaid",
      stay_type,
      booking_flow: "instant_book",
      flow_state: "payment_pending",
    };
    if (stay_type === "hourly") {
      payload.arrival_time = arrival_time;
      payload.duration_hours = duration_hours;
      payload.starts_at = startsAt;
      payload.ends_at = endsAt;
    }

    const { data: insertData, error: insertError } = await adminClient
      .from("bookings")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      console.error("Booking insert error:", insertError);
      return json({ error: "Failed to create booking", detail: insertError.message }, 500);
    }
    const bookingId = insertData.id as string;

    // If checkout can't be set up, cancel the just-created booking so it doesn't
    // hold inventory (pending bookings block availability + overlap checks).
    const cancelDangling = async () => {
      await adminClient.from("bookings")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", bookingId);
    };

    // ── PayMongo hosted checkout ──
    const paymentsEnabled = Deno.env.get("PAYMENTS_ENABLED") !== "false";
    const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymentsEnabled) {
      await cancelDangling();
      return json({ error: "Payments are currently disabled" }, 403);
    }
    if (!paymongoKey) {
      await cancelDangling();
      return json({
        error: "Payment gateway not configured",
        message: "PAYMONGO_SECRET_KEY is not set in Supabase Edge Function secrets.",
      }, 503);
    }

    const pmMethodMap: Record<string, string[]> = {
      gcash: ["gcash"], maya: ["paymaya"], card: ["card"],
    };
    const idempotencyKey = `guest-book:${bookingId}:${payment_method}:v1`;
    const sessionPayload = {
      data: {
        attributes: {
          line_items: [{
            currency: "PHP",
            amount: Math.round(totalPhp * 100),
            name: `CheapStays: ${listing.title ?? "Property Booking"}`,
            description: stay_type === "hourly"
              ? `${duration_hours}h · ${check_in} ${arrival_time ?? ""}`
              : `${nights} night${nights === 1 ? "" : "s"} · ${check_in} to ${check_out}`,
            quantity: 1,
          }],
          payment_method_types: pmMethodMap[payment_method],
          // Guests have no session, so land them on the public success page (not
          // /my-bookings, which would bounce them to sign-in).
          success_url: `${siteUrl}/booking-success?booking=${bookingId}` +
            `&email=${encodeURIComponent(email)}&amount=${totalPhp}` +
            `&title=${encodeURIComponent(listing.title ?? "")}` +
            `&city=${encodeURIComponent(listing.city ?? "")}&guest=1`,
          cancel_url: `${siteUrl}/listing/${listing_id}?payment=cancelled`,
          metadata: { booking_id: bookingId, user_id: guestUserId, guest_checkout: "true" },
        },
      },
    };

    const pmRes = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
      method: "POST",
      headers: pmHeaders(paymongoKey, idempotencyKey),
      body: JSON.stringify(sessionPayload),
    });
    const pmJson = await pmRes.json() as {
      data?: { id: string; attributes: { checkout_url: string } };
      errors?: { detail: string }[];
    };
    if (!pmRes.ok) {
      await cancelDangling();
      const detail = pmJson.errors?.[0]?.detail ?? "Payment provider error";
      return json({ error: detail }, 502);
    }
    const checkoutSession = pmJson.data;
    const checkoutUrl = checkoutSession?.attributes?.checkout_url;
    if (!checkoutSession?.id || !checkoutUrl) {
      await cancelDangling();
      return json({ error: "Payment provider returned an invalid checkout session" }, 502);
    }

    const { error: updateError } = await adminClient.from("bookings").update({
      payment_provider: "paymongo",
      payment_method,
      payment_ref: checkoutSession.id,
      paymongo_idempotency_key: idempotencyKey,
      payment_state: "intent_created",
      payment_status: "pending",
    }).eq("id", bookingId);
    if (updateError) {
      await cancelDangling();
      return json({ error: "Failed to persist checkout session", detail: updateError.message }, 500);
    }

    // ── Email the guest (best-effort; never blocks the response) ──
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const stayLine = stay_type === "hourly"
        ? `${duration_hours} hour stay on ${check_in}${arrival_time ? ` from ${arrival_time}` : ""}`
        : `${nights} night${nights === 1 ? "" : "s"}: ${check_in} → ${check_out}`;
      const subject = `Your CheapStays booking — ${listing.title ?? "your stay"}`;
      const text = [
        `Hi ${contact.full_name.trim()},`,
        ``,
        `Thanks for booking with CheapStays. Here are your details:`,
        ``,
        `Property: ${listing.title ?? "Your stay"}`,
        `Dates: ${stayLine}`,
        `Guests: ${guests}`,
        `Total: ₱${totalPhp.toLocaleString()} (incl. 5% service fee)`,
        ``,
        accountCreated
          ? `We've created an account for you so you can manage this booking.`
          : `This booking was added to your existing CheapStays account.`,
        `Sign in instantly (no password needed) here:`,
        actionLink,
        ``,
        `If your payment is still pending, you can complete it from My Bookings after signing in.`,
        ``,
        `— The CheapStays team`,
      ].join("\n");
      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto">
          <h2 style="margin:0 0 8px">Your CheapStays booking</h2>
          <p>Hi ${contact.full_name.trim()}, thanks for booking with CheapStays.</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr><td style="padding:6px 0;color:#666">Property</td><td style="padding:6px 0;text-align:right"><b>${listing.title ?? "Your stay"}</b></td></tr>
            <tr><td style="padding:6px 0;color:#666">Dates</td><td style="padding:6px 0;text-align:right">${stayLine}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Guests</td><td style="padding:6px 0;text-align:right">${guests}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Total</td><td style="padding:6px 0;text-align:right"><b>₱${totalPhp.toLocaleString()}</b> <span style="color:#999">(incl. 5% fee)</span></td></tr>
          </table>
          <p style="margin-top:16px">${accountCreated
            ? "We've created an account for you so you can manage this booking."
            : "This booking was added to your existing CheapStays account."}</p>
          <p style="margin:16px 0">
            <a href="${actionLink}" style="background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Sign in & view booking</a>
          </p>
          <p style="color:#999;font-size:12px">If your payment is still pending, complete it from My Bookings after signing in.</p>
        </div>`;

      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-notification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, subject, text, html }),
      });
    } catch (mailErr) {
      console.error("Guest email failed (non-fatal):", mailErr);
    }

    return json({
      message: "Booking initiated",
      booking_id: bookingId,
      checkout_url: checkoutUrl,
      account_created: accountCreated,
    }, 201);
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
