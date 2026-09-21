import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  token: z.string().min(16).max(128),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`guest-review-lookup:${ip}`, 60, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    let body: unknown;
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid token" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rr } = await admin
      .from("review_requests")
      .select("id, booking_id, listing_id, expires_at, submitted_review_id, submitted_at")
      .eq("token", parsed.data.token)
      .maybeSingle();

    if (!rr) return json({ status: "not_found" }, 404);

    const status =
      rr.submitted_review_id ? "already_submitted"
      : new Date(rr.expires_at as string).getTime() < Date.now() ? "expired"
      : "ready";

    const { data: booking } = await admin
      .from("bookings")
      .select("check_in, check_out, nights, guests, guest_name_snapshot, guest_id")
      .eq("id", rr.booking_id as string)
      .maybeSingle();

    const { data: listing } = await admin
      .from("listings")
      .select("id, title, city, province, images, host_id")
      .eq("id", rr.listing_id as string)
      .maybeSingle();
    const coverPhoto = Array.isArray(listing?.images) && listing.images.length > 0
      ? listing.images[0]
      : null;

    // Host display name for the review page hero.
    let hostName: string | null = null;
    if (listing?.host_id) {
      const { data: hostProfile } = await admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", listing.host_id)
        .maybeSingle();
      hostName = (hostProfile as { display_name: string | null } | null)?.display_name ?? null;
    }

    // Guest display name — prefer profiles.display_name over snapshot.
    let guestName: string | null = booking?.guest_name_snapshot ?? null;
    if (booking?.guest_id) {
      const { data: gp } = await admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", booking.guest_id)
        .maybeSingle();
      const n = (gp as { display_name: string | null } | null)?.display_name;
      if (n) guestName = n;
    }

    return json({
      status,
      listing: listing ? {
        id: listing.id,
        title: listing.title,
        city: listing.city,
        province: listing.province,
        cover_photo_url: coverPhoto,
        host_name: hostName,
      } : null,
      stay: booking ? {
        check_in: booking.check_in,
        check_out: booking.check_out,
        nights: booking.nights,
        guests: booking.guests,
        guest_name: guestName,
      } : null,
      expires_at: rr.expires_at,
      submitted_at: rr.submitted_at,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
