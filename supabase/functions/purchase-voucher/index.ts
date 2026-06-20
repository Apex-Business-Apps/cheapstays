import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  listing_id: z.string().uuid(),
  duration_hours: z.number().int(),
});

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
    const rl = await rateLimit(`purchase-voucher:${ip}`, 10, 60_000);
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

    const { listing_id, duration_hours } = parsed.data;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: listing, error: listingError } = await adminClient
      .from("listings")
      .select("id, status, host_id, booking_mode, hourly_php, price_3h, price_6h, price_12h")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) return json({ error: "Listing not found" }, 404);

    if (listing.status !== "active") {
      return json({ error: "Listing is not available" }, 409);
    }
    
    // P0 Hotfix: Block the voucher payment path as requested by APEX rules
    // until full integration with PayMongo is deployed and tested.
    return json({ error: "Voucher purchases are currently disabled pending payment gateway integration." }, 403);
    
    if (listing.booking_mode !== "voucher") {
      return json({ error: "This listing does not support open-date vouchers." }, 400);
    }

    if (listing.host_id === user.id) {
      return json({ error: "You cannot buy a voucher for your own listing" }, 403);
    }

    if (![3, 6, 12].includes(duration_hours)) {
      return json({ error: "Unsupported duration. Must be 3, 6, or 12 hours." }, 400);
    }

    // Determine subtotal based on duration block
    let subtotal = 0;
    if (duration_hours === 3 && listing.price_3h) subtotal = listing.price_3h;
    else if (duration_hours === 6 && listing.price_6h) subtotal = listing.price_6h;
    else if (duration_hours === 12 && listing.price_12h) subtotal = listing.price_12h;
    else return json({ error: "Pricing is not configured for this voucher duration" }, 400);

    const serviceFee = Math.round(subtotal * 0.05);
    const totalPhp = subtotal + serviceFee;

    // Generate unique code (retry mechanism is ideal, but a random string is sufficient for now)
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data: insertData, error: insertError } = await adminClient
      .from("vouchers")
      .insert({
        code,
        listing_id,
        guest_id: user.id,
        duration_hours,
        amount_paid: totalPhp,
        status: "pending_payment"
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Voucher insert error:", insertError);
      return json({ error: "Failed to create voucher" }, 500);
    }

    return json({
      message: "Voucher purchase initiated",
      voucher_id: insertData.id,
      total_php: totalPhp,
    }, 201);

  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
