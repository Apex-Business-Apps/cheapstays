import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  token: z.string().min(16).max(128),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional().default(""),
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
    const rl = await rateLimit(`guest-review-submit:${ip}`, 20, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    let body: unknown;
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid submission" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rr, error: rrErr } = await admin
      .from("review_requests")
      .select("id, booking_id, listing_id, host_id, guest_id, guest_name_snapshot, guest_email, expires_at, submitted_review_id")
      .eq("token", parsed.data.token)
      .maybeSingle();

    if (rrErr) throw rrErr;
    if (!rr) return json({ error: "Invalid or expired link" }, 404);
    if (rr.submitted_review_id) return json({ error: "You already submitted a review for this stay" }, 400);
    if (new Date(rr.expires_at as string).getTime() < Date.now()) {
      return json({ error: "This review link has expired" }, 400);
    }

    const trimmedBody = parsed.data.body.trim();
    const { data: review, error: revErr } = await admin
      .from("reviews")
      .insert({
        booking_id: rr.booking_id,
        listing_id: rr.listing_id,
        reviewer_id: rr.guest_id,
        reviewee_id: rr.host_id,
        host_id: rr.host_id,
        reviewer_role: "guest",
        reviewer_name_snapshot: rr.guest_id ? null : rr.guest_name_snapshot,
        reviewer_email_snapshot: rr.guest_id ? null : rr.guest_email,
        rating: parsed.data.rating,
        body: trimmedBody.length > 0 ? trimmedBody : null,
        is_public: true,
      })
      .select("id")
      .single();

    if (revErr) {
      // Unique-violation on (booking_id, reviewer_role) means a stray review row
      // exists already — treat as already-submitted.
      if (String(revErr.message).toLowerCase().includes("duplicate")) {
        return json({ error: "A review for this stay already exists" }, 400);
      }
      throw revErr;
    }

    const { error: updErr } = await admin
      .from("review_requests")
      .update({
        submitted_review_id: review.id,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", rr.id);
    if (updErr) throw updErr;

    return json({ success: true, review_id: review.id });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
