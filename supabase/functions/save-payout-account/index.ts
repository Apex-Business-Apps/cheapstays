import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { encrypt } from "../_shared/encryption.ts";

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

  if (!payout_method || !account_holder_name || !account_number) {
    return json({ error: "Missing required fields: payout_method, account_holder_name, account_number" }, 400);
  }

  const encryptedNumber = await encrypt(account_number);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await serviceClient
    .from("host_payout_accounts")
    .upsert(
      { host_id: user.id, payout_method, account_holder_name, account_number_enc: encryptedNumber },
      { onConflict: "host_id" }
    );

  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
});
