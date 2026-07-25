// Admin uploads proof of a manual payment (screenshot / QR).
// The client uploads the image to Storage first, then calls this
// with the resulting path.

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

  const { user, supabase, error: authError } = await getUserFromRequest(req);
  if (authError || !user || !supabase) return json(401, { error: "Unauthorized" });

  const { data: isAdminData } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (!isAdminData) return json(403, { error: "Admin only" });

  const rl = await rateLimit(`attach-disbursement-proof:${user.id}`, 30, 60_000);
  if (!rl.ok) return json(429, { error: "Rate limited" });

  let body: { disbursement_id?: string; proof_image_path?: string; admin_note?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const { disbursement_id, proof_image_path, admin_note } = body;
  if (!disbursement_id || !proof_image_path) {
    return json(400, { error: "disbursement_id and proof_image_path required" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request, error: fetchError } = await admin
    .from("disbursement_requests")
    .select("id, wallet_id, amount, status")
    .eq("id", disbursement_id)
    .maybeSingle();

  if (fetchError || !request) return json(404, { error: "Request not found" });
  if (request.status !== "pending") return json(409, { error: "Request is not pending" });

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("disbursement_requests")
    .update({
      status: "awaiting_confirmation",
      proof_image_path,
      admin_note: admin_note ?? null,
      released_by: user.id,
      released_at: now,
      processed_at: now,
    })
    .eq("id", disbursement_id);

  if (updateError) return json(500, { error: updateError.message });

  const { data: wallet } = await admin
    .from("host_wallets")
    .select("host_id")
    .eq("id", request.wallet_id)
    .maybeSingle();

  if (wallet?.host_id) {
    await dispatchNotification(admin, {
      userId: wallet.host_id,
      type: "disbursement_proof_uploaded",
      title: "Payout proof uploaded",
      body:
        `Admin sent your payout of ₱${Number(request.amount).toLocaleString("en-PH")}. ` +
        `Open your wallet to view the proof and confirm receipt.`,
      url: "/host/wallet",
      data: { disbursement_id },
    }).catch(() => undefined);
  }

  return json(200, { ok: true });
});
