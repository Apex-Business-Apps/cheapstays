import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

// Canonical stay-length boundary. Short-term = 1..SHORT_TERM_MAX_NIGHTS;
// long-term = SHORT_TERM_MAX_NIGHTS+1 onwards. Single source of truth — every
// other surface must derive routing from this constant via this edge function.
const SHORT_TERM_MAX_NIGHTS = 30;

const BodySchema = z.object({
  listing_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  guests: z.number().int().min(1).max(20),
  guest_message: z.string().max(1000).optional(),
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

    const { listing_id, check_in, check_out, guests, guest_message } = parsed.data;

    if (check_out <= check_in) {
      return json({ error: "check_out must be after check_in" }, 400);
    }

    const nights = dateDiffDays(check_in, check_out);
    if (nights < 1) return json({ error: "Stay must be at least 1 night" }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: listing, error: listingError } = await adminClient
      .from("listings")
      .select(
        "id, title, host_id, nightly_php, max_guests, min_nights, max_nights, " +
        "short_term_enabled, long_term_enabled, status, visibility",
      )
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) return json({ error: "Listing not found" }, 404);

    if (listing.status !== "active") {
      return json({ error: "Listing is not available for booking" }, 409);
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

    if (nights < listing.min_nights) {
      return json(
        { error: `Minimum stay is ${listing.min_nights} night(s). Requested: ${nights}` },
        400,
      );
    }

    // max_nights is a property cap (NULL = uncapped).
    if (listing.max_nights != null && nights > listing.max_nights) {
      return json(
        { error: `Maximum stay is ${listing.max_nights} night(s). Requested: ${nights}` },
        400,
      );
    }

    // ── Canonical routing: stay length is the SOLE authority. ────────────────
    // listing.instant_book and listing.is_owner_direct are intentionally not
    // read here — they are legacy/marketing fields per the locked decisions.
    const isShortTerm = nights <= SHORT_TERM_MAX_NIGHTS;
    const stay_type   = isShortTerm ? "short_term" : "long_term";
    const booking_flow = isShortTerm ? "instant_book" : "request_booking";

    if (isShortTerm && !listing.short_term_enabled) {
      return json(
        { error: "This listing does not accept short-term (≤30 night) stays" },
        400,
      );
    }
    if (!isShortTerm && !listing.long_term_enabled) {
      return json(
        { error: "This listing does not accept long-term (31+ night) stays" },
        400,
      );
    }

    // Availability check — overlap with any non-cancelled/no-show booking.
    const { data: conflicts, error: conflictError } = await adminClient
      .from("bookings")
      .select("id")
      .eq("listing_id", listing_id)
      .not("status", "in", '("cancelled","no_show")')
      .lt("check_in", check_out)
      .gt("check_out", check_in);

    if (conflictError) {
      return json(
        { error: "Failed to check availability", detail: conflictError.message },
        500,
      );
    }
    if (conflicts && conflicts.length > 0) {
      return json({ error: "Selected dates are not available" }, 409);
    }

    const { data: blackouts, error: blackoutError } = await adminClient
      .from("listing_blackout_dates")
      .select("date")
      .eq("listing_id", listing_id)
      .gte("date", check_in)
      .lt("date", check_out)
      .limit(1);
    if (blackoutError) return json({ error: "Failed to check blackout dates", detail: blackoutError.message }, 500);
    if ((blackouts?.length ?? 0) > 0) return json({ error: "Selected dates overlap listing blackout dates" }, 409);

    if (listing.status === "active" || listing.visibility === "publishable") {
      const { data: window, error: windowError } = await adminClient
        .from("listing_availability_windows")
        .select("declared_through")
        .eq("listing_id", listing_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (windowError) return json({ error: "Failed to check declared availability", detail: windowError.message }, 500);
      if (window?.declared_through && check_out > window.declared_through) {
        return json({ error: "Requested stay exceeds declared availability window" }, 409);
      }
    }

    // 5% service fee matches BookingPanel display.
    const SERVICE_FEE_RATE = 0.05;
    const total_php = Math.round(
      nights * Number(listing.nightly_php) * (1 + SERVICE_FEE_RATE),
    );

    // Stay-length determines flow_state + coarse legacy status. Short-term
    // = instant book (active/confirmed). Long-term = request booking
    // (requested/pending) with a 24-hour approval deadline.
    const now = new Date();
    const flow_state = isShortTerm ? "payment_pending" : "requested";
    const legacy_status = "pending";
    const approval_deadline_at = isShortTerm
      ? null
      : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const confirmed_at = null;

    const { data: booking, error: insertError } = await adminClient
      .from("bookings")
      .insert({
        listing_id,
        guest_id: user.id,
        host_id: listing.host_id,
        check_in,
        check_out,
        nights,
        guests,
        total_php,
        status: legacy_status,
        payment_status: "unpaid",
        stay_type,
        booking_flow,
        flow_state,
        approval_deadline_at,
        confirmed_at,
        guest_message: guest_message ?? null,
      })
      .select("id")
      .single();

    if (insertError || !booking) {
      return json(
        { error: "Failed to create booking", detail: insertError?.message },
        500,
      );
    }

    // Record the initial transition. Best-effort: if this fails the booking
    // still stands, but we surface a non-blocking warning in the payload.
    const { error: transitionError } = await adminClient
      .from("booking_transitions")
      .insert({
        booking_id: booking.id,
        from_state: null,
        to_state: flow_state,
        actor_user_id: user.id,
        actor_role: "guest",
        reason: isShortTerm ? "guest_short_term_hold_created" : "guest_requested_long_term",
        metadata: {
          stay_type,
          booking_flow,
          nights,
          total_php,
        },
      });

    return json(
      {
        booking_id: booking.id,
        listing_title: listing.title,
        check_in,
        check_out,
        nights,
        total_php,
        // Surface both fields so callers can drive UI without legacy guesses.
        stay_type,
        booking_flow,
        flow_state,
        // Coarse status preserved for any consumer still reading it.
        status: legacy_status,
        approval_deadline_at,
        message: isShortTerm
          ? "Provisional hold created. Complete payment to confirm your reservation."
          : "Long-term request submitted. The host has 24 hours to respond.",
        transition_warning: transitionError ? transitionError.message : null,
      },
      201,
    );
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
