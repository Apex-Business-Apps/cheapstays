import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  listing_id: z.string().uuid(),
  batch_name: z.string().min(1).max(120),
  nights:     z.number().int().min(1).max(30),
  price_php:  z.number().int().min(1),
  quantity:   z.number().int().min(1).max(500),
  valid_days: z.number().int().min(1).max(14),
  terms:      z.string().max(2000).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`admin-stay-voucher-batch-create:${ip}`, 30, 60_000);
  if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

  const { user, error: authErr } = await getUserFromRequest(req);
  if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { listing_id, batch_name, nights, price_php, quantity, valid_days, terms } = parsed.data;

  const { data: listing } = await admin
    .from("listings").select("id").eq("id", listing_id).maybeSingle();
  if (!listing) return json({ error: "Listing not found" }, 404);

  const { data: inserted, error } = await admin
    .from("stay_voucher_batches")
    .insert({
      listing_id, batch_name, nights, price_php, quantity, valid_days,
      terms: terms ?? null, is_active: true, created_by: user.id,
    })
    .select("id").single();
  if (error) return json({ error: error.message }, 500);

  return json({ batch_id: inserted.id }, 201);
});
