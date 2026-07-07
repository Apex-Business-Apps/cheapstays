import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { encrypt } from "../_shared/encryption.ts";

const PAYOUT_METHODS = ["GCASH", "MAYA", "PH_BANK"] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const { payout_method, account_holder_name, account_number } = body ?? {};

  if (
    typeof payout_method !== "string" ||
    typeof account_holder_name !== "string" ||
    typeof account_number !== "string"
  ) {
    return json({ error: "payout_method, account_holder_name, and account_number must be strings" }, 400);
  }

  if (!(PAYOUT_METHODS as readonly string[]).includes(payout_method)) {
    return json({ error: `payout_method must be one of: ${PAYOUT_METHODS.join(", ")}` }, 400);
  }

  const holderName = account_holder_name.trim();
  if (holderName.length < 2 || holderName.length > 120) {
    return json({ error: "account_holder_name must be between 2 and 120 characters" }, 400);
  }

  // Normalize separators, then require digits (optionally +-prefixed for mobile numbers)
  const normalizedNumber = account_number.replace(/[\s-]/g, "");
  if (!/^\+?\d{6,34}$/.test(normalizedNumber)) {
    return json({ error: "account_number must be 6-34 digits" }, 400);
  }

  const encryptedNumber = await encrypt(normalizedNumber);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Any change to payout details invalidates prior admin approval — the account
  // must be re-verified before disbursements are sent to it.
  const { error } = await serviceClient
    .from("host_payout_accounts")
    .upsert(
      {
        host_id: user.id,
        payout_method,
        account_holder_name: holderName,
        account_number_enc: encryptedNumber,
        is_verified: false,
        verified_by: null,
        verified_at: null,
      },
      { onConflict: "host_id" }
    );

  if (error) return json({ error: error.message }, 500);

  return json({ success: true, requires_verification: true });
});
