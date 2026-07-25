import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  code: z.string().min(6).max(32),
  listing_id: z.string().uuid(),
  p_check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  const rl = await rateLimit(`host-stay-voucher-redeem:${ip}`, 20, 60_000);
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

  const { data, error } = await admin.rpc("redeem_stay_voucher_transaction", {
    p_code: parsed.data.code.trim().toUpperCase(),
    p_listing_id: parsed.data.listing_id,
    p_caller_id: user.id,
    p_check_in: parsed.data.p_check_in,
  });
  if (error) return json({ error: error.message }, 400);

  // Fire-and-log: credit the host wallet. If this call fails the booking still
  // succeeded and is auditable — admins reconcile out of band.
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/credit-host-wallet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ booking_id: (data as { booking_id: string }).booking_id }),
    });
  } catch (err) {
    console.error("host-stay-voucher-redeem: credit-host-wallet failed (non-fatal):", err);
  }

  return json(data as Record<string, unknown>, 200);
});
