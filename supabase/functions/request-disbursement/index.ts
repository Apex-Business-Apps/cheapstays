// Host-initiated disbursement request.
// Contract:
//  - POST /functions/v1/request-disbursement  (no body)
//  - Requires Bearer JWT; caller must be the wallet owner.
//  - Preconditions: available >= 500, verified payout account,
//    no in-flight request, once per 7 days.
//  - Debits wallet to 0 atomically after the request row is created.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dispatchNotification } from "../_shared/notify.ts";

const MINIMUM_PAYOUT = 500;

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

  const rl = await rateLimit(`request-disbursement:${user.id}`, 1, 7 * 24 * 60 * 60 * 1000);
  if (!rl.ok) {
    return json(429, {
      error: "You can only request a payout once per week.",
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load wallet
  const { data: wallet, error: walletError } = await admin
    .from("host_wallets")
    .select("id, available_balance, is_frozen")
    .eq("host_id", user.id)
    .maybeSingle();

  if (walletError || !wallet) return json(404, { error: "Wallet not found" });
  if (wallet.is_frozen) return json(403, { error: "Wallet is frozen — contact support" });
  const available_balance = Number(wallet.available_balance);
  if (available_balance < MINIMUM_PAYOUT) {
    return json(409, { error: `Minimum payout is ₱${MINIMUM_PAYOUT}` });
  }

  // Verified payout account
  const { data: payoutAccount } = await admin
    .from("host_payout_accounts")
    .select("payout_method, account_number_enc, is_verified")
    .eq("host_id", user.id)
    .maybeSingle();

  if (!payoutAccount || !payoutAccount.is_verified) {
    return json(403, { error: "Payout account not verified" });
  }

  // In-flight guard (defense against race with the partial unique index)
  const { data: inFlight } = await admin
    .from("disbursement_requests")
    .select("id")
    .eq("wallet_id", wallet.id)
    .or("status.in.(pending,awaiting_confirmation)")
    .maybeSingle();

  if (inFlight) return json(409, { error: "A disbursement request is already in progress" });

  const amount = available_balance;
  const now = new Date();
  const cycleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Create the request row first
  const { data: created, error: insertError } = await admin
    .from("disbursement_requests")
    .insert({
      wallet_id: wallet.id,
      amount,
      status: "pending",
      payout_method: payoutAccount.payout_method,
      account_details_enc: payoutAccount.account_number_enc,
      cycle_month: cycleMonth,
      trigger: "manual",
      requested_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return json(500, { error: `Insert failed: ${insertError?.message ?? "unknown"}` });
  }

  // Debit the wallet
  const { error: debitError } = await admin
    .from("host_wallets")
    .update({ available_balance: 0 })
    .eq("id", wallet.id);

  if (debitError) {
    // Roll back the request so we never have a request without a debit
    await admin.from("disbursement_requests").delete().eq("id", created.id);
    return json(500, { error: `Debit failed: ${debitError.message}` });
  }

  await admin.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    type: "debit_disbursement",
    amount,
    status: "completed",
    disbursement_id: created.id,
    description: `Manual payout request ${cycleMonth}`,
  });

  // Notify every admin
  const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  await Promise.all(
    (admins ?? []).map((row: { user_id: string }) =>
      dispatchNotification(admin, {
        userId: row.user_id,
        type: "disbursement_requested",
        title: "New payout request",
        body: `A host requested a payout of ₱${amount.toLocaleString("en-PH")}.`,
        url: "/admin/disbursements",
        data: { disbursement_id: created.id },
      }).catch(() => undefined),
    ),
  );

  return json(200, { "ok": true, disbursement_id: created.id, amount });
});
