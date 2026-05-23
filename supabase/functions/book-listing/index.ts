import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`book-listing:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: verify caller via their JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Validate request body ---
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { listing_id, check_in, check_out, guests, guest_message } = parsed.data;

    // --- Basic date validation ---
    if (check_out <= check_in) {
      return new Response(
        JSON.stringify({ error: "check_out must be after check_in" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nights = dateDiffDays(check_in, check_out);

    // Use service role for all DB reads (needs to see all listings + bookings, not just user's)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Fetch listing ---
    const { data: listing, error: listingError } = await adminClient
      .from("listings")
      .select("id, title, host_id, nightly_php, max_guests, min_nights, instant_book, status")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (listing.status !== "active") {
      return new Response(JSON.stringify({ error: "Listing is not available for booking" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (listing.host_id === user.id) {
      return new Response(JSON.stringify({ error: "You cannot book your own listing" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- Business rule validation ---
    if (guests > listing.max_guests) {
      return new Response(
        JSON.stringify({
          error: `Too many guests. Maximum allowed: ${listing.max_guests}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (nights < listing.min_nights) {
      return new Response(
        JSON.stringify({
          error: `Minimum stay is ${listing.min_nights} night(s). Requested: ${nights}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Check for conflicting bookings ---
    // Overlap condition: NOT (check_out <= existing_check_in OR check_in >= existing_check_out)
    const { data: conflicts, error: conflictError } = await adminClient
      .from("bookings")
      .select("id")
      .eq("listing_id", listing_id)
      .not("status", "in", '("cancelled","no_show")')
      .lt("check_in", check_out)   // existing starts before our checkout
      .gt("check_out", check_in);  // existing ends after our checkin

    if (conflictError) {
      return new Response(
        JSON.stringify({ error: "Failed to check availability", detail: conflictError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: "Selected dates are not available" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Calculate totals (5% service fee matches BookingPanel.tsx display) ---
    const SERVICE_FEE_RATE = 0.05;
    const total_php = Math.round(nights * Number(listing.nightly_php) * (1 + SERVICE_FEE_RATE));
    const status = listing.instant_book ? "confirmed" : "pending";

    // --- Insert booking (use service role so we can write on behalf of the user) ---
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
        status,
        payment_status: "unpaid",
        guest_message: guest_message ?? null,
      })
      .select("id")
      .single();

    if (insertError || !booking) {
      return new Response(
        JSON.stringify({ error: "Failed to create booking", detail: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        booking_id: booking.id,
        listing_title: listing.title,
        check_in,
        check_out,
        nights,
        total_php,
        status,
        message: listing.instant_book
          ? "Your booking is confirmed! Proceed to payment to secure your stay."
          : "Booking request submitted. The host will confirm within 24 hours.",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
