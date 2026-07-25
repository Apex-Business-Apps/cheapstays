import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({ code: z.string().min(6).max(32) });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`host-stay-voucher-preview:${ip}`, 20, 60_000);
  if (!rl.ok) return json({ error: "Too many requests" }, 429);

  const { user, error: authErr } = await getUserFromRequest(req);
  if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isHost } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "host",
  });
  if (!isHost) return json({ error: "Forbidden" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const code = parsed.data.code.trim().toUpperCase();

  const { data: row } = await admin
    .from("stay_voucher_codes")
    .select(`
      id, code, status, valid_until, purchase_id,
      batch:stay_voucher_batches(id, batch_name, nights, price_php, listing_id),
      purchase:stay_voucher_purchases(buyer_name)
    `)
    .eq("code", code)
    .maybeSingle();
  if (!row) return json({ error: "Voucher code not found" }, 404);

  const batch = (row as unknown as { batch: {
    id: string; batch_name: string; nights: number; price_php: number; listing_id: string;
  } }).batch;
  const { data: listing } = await admin
    .from("listings").select("id, title, host_id").eq("id", batch.listing_id).single();

  if (listing.host_id !== user.id) return json({ error: "You do not host this listing." }, 403);

  return json({
    batch_name: batch.batch_name,
    nights: batch.nights,
    price_php: batch.price_php,
    buyer_name: (row as unknown as { purchase: { buyer_name: string } }).purchase.buyer_name,
    valid_until: (row as { valid_until: string }).valid_until,
    status: (row as { status: string }).status,
    listing: { id: listing.id, title: listing.title },
  });
});
