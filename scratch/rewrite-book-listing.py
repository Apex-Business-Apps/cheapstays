import os

content = """import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

// Canonical stay-length boundary. Short-term = 1..SHORT_TERM_MAX_NIGHTS;
// long-term = SHORT_TERM_MAX_NIGHTS+1 onwards. Single source of truth — every
// other surface must derive routing from this constant via this edge function.
const SHORT_TERM_MAX_NIGHTS = 30;

const BodySchema = z.object({
  listing_id: z.string().uuid(),
  check_in: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Must be YYYY-MM-DD"),
  check_out: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Must be YYYY-MM-DD"),
  guests: z.number().int().min(1).max(20),
  guest_message: z.string().max(1000).optional(),
  stay_type: z.enum(["overnight", "hourly"]).optional().default("overnight"),
  arrival_time: z.string().regex(/^\\d{2}:\\d{2}$/).optional(),
  duration_hours: z.number().int().optional(),
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`book-listing:${ip}`, 10, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const { listing_id, check_in, check_out, guests, guest_message, stay_type, arrival_time, duration_hours } = parsed.data;

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
        "id, title, host_id, nightly_php, max_guests, min_nights, max_nights, " +
        "short_term_enabled, long_term_enabled, status, visibility, " +
        "stay_availability_type, booking_mode, hourly_php, price_3h, price_6h, price_12h"
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

    if (listing.host_id === user.id) {
      return json({ error: "You cannot book your own listing" }, 403);
    }

    if (guests > listing.max_guests) {
      return json(
        { error: `Too many guests. Maximum allowed: ${listing.max_guests}` },
        400,
      );
    }

    if (stay_type === "overnight" && nights < listing.min_nights) {
      return json(
        { error: `Minimum stay is ${listing.min_nights} night(s). Requested: ${nights}` },
        400,
      );
    }

    if (stay_type === "overnight" && listing.max_nights && nights > listing.max_nights) {
      return json(
        { error: `Maximum stay is ${listing.max_nights} night(s). Requested: ${nights}` },
        400,
      );
    }

    const isShortTermStay = nights <= SHORT_TERM_MAX_NIGHTS;
    const isLongTermStay = nights > SHORT_TERM_MAX_NIGHTS;

    if (stay_type === "overnight" && isShortTermStay && listing.short_term_enabled === false) {
      return json({ error: "This listing does not accept short-term stays (≤30 nights)" }, 400);
    }

    if (stay_type === "overnight" && isLongTermStay && listing.long_term_enabled !== true) {
      return json({ error: "This listing does not accept long-term stays (31+ nights)" }, 400);
    }

    // Determine booking mode and total
    let bookingFlow = "instant_book";
    let subtotal = 0;
    
    if (stay_type === "overnight") {
      if (isLongTermStay) bookingFlow = "request_booking";
      subtotal = nights * listing.nightly_php;
    } else {
      // hourly
      bookingFlow = "instant_book"; // Hourly is always instant book for now
      if (durationHours === 3 && listing.price_3h) subtotal = listing.price_3h;
      else if (durationHours === 6 && listing.price_6h) subtotal = listing.price_6h;
      else if (durationHours === 12 && listing.price_12h) subtotal = listing.price_12h;
      else if (listing.hourly_php) subtotal = listing.hourly_php * (durationHours ?? 1);
      else return json({ error: "Hourly pricing is not configured for this duration" }, 400);
    }

    const serviceFee = Math.round(subtotal * 0.05);
    const totalPhp = subtotal + serviceFee;
    
    // Compute starts_at / ends_at for hourly
    let startsAt = null;
    let endsAt = null;
    if (stay_type === "hourly" && arrival_time && duration_hours) {
      startsAt = `${check_in}T${arrival_time}:00Z`;
      // naive calculation for endsAt (ignores timezone/DST for this MVP)
      const dateObj = new Date(startsAt);
      dateObj.setHours(dateObj.getHours() + duration_hours);
      endsAt = dateObj.toISOString();
    }

    const payload: any = {
      listing_id,
      guest_id: user.id,
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
      booking_flow: bookingFlow,
      flow_state: bookingFlow === "instant_book" ? "awaiting_payment" : "awaiting_host_approval",
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
      return json({ error: "Failed to create booking" }, 500);
    }

    return json({
      message: "Booking initiated",
      booking_id: insertData.id,
      booking_flow: bookingFlow,
      total_php: totalPhp,
    }, 201);

  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
"""

with open(r"c:\Users\sinyo\CheapStays\cheapstays\supabase\functions\book-listing\index.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("book-listing edge function rewritten successfully.")
