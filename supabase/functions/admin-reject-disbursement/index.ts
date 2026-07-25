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

  const rl = await rateLimit(`reject-disbursement:${user.id}`, 30, 60_000);
  if (!rl.ok) return json(429, { error: "Rate limited" });

  let body: { disbursement_id?: string; rejection_reason?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const { disbursement_id, rejection_reason } = body;
  if (!disbursement_id || !rejection_reason?.trim()) {
    return json(400, { error: "disbursement_id and rejection_reason required" });
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
  if (!["pending", "awaiting_confirmation"].includes(request.status)) {
    return json(409, { error: `Cannot reject a request in status ${request.status}` });
  }

  const { data: wallet } = await admin
    .from("host_wallets")
    .select("host_id, available_balance")
    .eq("id", request.wallet_id)
    .maybeSingle();

  if (!wallet) return json(500, { error: "Wallet lookup failed" });

  const refunded = Number(request.amount);
  const newBalance = Number(wallet.available_balance) + refunded;

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("disbursement_requests")
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejected_at: now,
      rejection_reason,
    })
    .eq("id", disbursement_id);
  if (updateError) return json(500, { error: updateError.message });

  const { error: refundError } = await admin
    .from("host_wallets")
    .update({ available_balance: newBalance })
    .eq("id", request.wallet_id);
  if (refundError) return json(500, { error: `Refund failed: ${refundError.message}` });

  await admin.from("wallet_transactions").insert({
    wallet_id: request.wallet_id,
    type: "debit_failed_reversal",
    amount: refunded,
    status: "completed",
    disbursement_id: request.id,
    description: `Payout rejected: ${rejection_reason}`,
  });

  if (wallet.host_id) {
    await dispatchNotification(admin, {
      userId: wallet.host_id,
      type: "disbursement_rejected",
      title: "Payout request rejected",
      body: `Your payout of ₱${refunded.toLocaleString("en-PH")} was rejected. Reason: ${rejection_reason}. The balance has been returned to your wallet.`,
      url: "/host/wallet",
      data: { disbursement_id },
    }).catch(() => undefined);
  }

  return json(200, { ok: true, refunded_amount: refunded });
});
