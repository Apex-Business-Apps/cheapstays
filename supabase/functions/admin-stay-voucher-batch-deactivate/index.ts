import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({ batch_id: z.string().uuid() });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`admin-stay-voucher-batch-deactivate:${ip}`, 30, 60_000);
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

  const { error } = await admin
    .from("stay_voucher_batches")
    .update({ is_active: false })
    .eq("id", parsed.data.batch_id);
  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
});
