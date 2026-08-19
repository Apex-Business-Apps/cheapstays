// Admin-only lookup for a host's payout account, keyed by disbursement id.
//
// The account number is AES-encrypted at rest; only edge functions with
// WALLET_ENCRYPTION_KEY can decrypt. Admins need the plaintext to actually
// send the manual off-platform payment.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { decrypt } from "../_shared/encryption.ts";

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

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (!isAdmin) return json(403, { error: "Admin only" });

  const rl = await rateLimit(`admin-get-payout-account:${user.id}`, 30, 60_000);
  if (!rl.ok) return json(429, { error: "Rate limited" });

  let body: { disbursement_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const { disbursement_id } = body;
  if (!disbursement_id) return json(400, { error: "disbursement_id required" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request } = await admin
    .from("disbursement_requests")
    .select("id, wallet_id")
    .eq("id", disbursement_id)
    .maybeSingle();
  if (!request) return json(404, { error: "Request not found" });

  const { data: wallet } = await admin
    .from("host_wallets")
    .select("host_id")
    .eq("id", request.wallet_id)
    .maybeSingle();
  if (!wallet) return json(404, { error: "Wallet not found" });

  const { data: account } = await admin
    .from("host_payout_accounts")
    .select("payout_method, account_holder_name, account_number_enc, is_verified, updated_at")
    .eq("host_id", wallet.host_id)
    .maybeSingle();
  if (!account) return json(404, { error: "Host has no payout account on file" });

  let accountNumber = "";
  try {
    accountNumber = await decrypt(account.account_number_enc);
  } catch (err) {
    console.error("decrypt failed:", err);
    return json(500, { error: "Failed to decrypt account number" });
  }

  return json(200, {
    payout_method: account.payout_method,
    account_holder_name: account.account_holder_name,
    account_number: accountNumber,
    is_verified: account.is_verified,
    updated_at: account.updated_at,
  });
});
