import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dispatchNotification } from "../_shared/notify.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError || !user) return json(401, { error: "Unauthorized" });

  const rl = await rateLimit(`confirm-disbursement:${user.id}`, 20, 60_000);
  if (!rl.ok) return json(429, { error: "Rate limited" });

  let body: { disbursement_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const { disbursement_id } = body;
  if (!disbursement_id) return json(400, { error: "disbursement_id required" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request, error: fetchError } = await admin
    .from("disbursement_requests")
    .select("id, wallet_id, amount, status, host_wallets!inner(host_id)")
    .eq("id", disbursement_id)
    .maybeSingle();

  if (fetchError || !request) return json(404, { error: "Request not found" });

  // Ownership check — join surfaces host_id as request.host_wallets.host_id
  const ownerId = (request as unknown as { host_wallets: { host_id: string } }).host_wallets.host_id;
  if (ownerId !== user.id) return json(403, { error: "Not your request" });

  if (request.status !== "awaiting_confirmation") {
    return json(409, { error: `Cannot confirm a request in status ${request.status}` });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("disbursement_requests")
    .update({ status: "released", confirmed_at: now })
    .eq("id", disbursement_id);
  if (updateError) return json(500, { error: updateError.message });

  await dispatchNotification(admin, {
    userId: user.id,
    type: "disbursement_released",
    title: "Payout confirmed",
    body: `You confirmed receipt of ₱${Number(request.amount).toLocaleString("en-PH")}. Thank you.`,
    url: "/host/wallet",
    data: { disbursement_id },
  }).catch(() => undefined);

  return json(200, { ok: true });
});
