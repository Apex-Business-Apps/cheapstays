import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { user, error } = await getUserFromRequest(req);
  if (error || !user) return json({ error: "Unauthorized" }, 401);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: roleData } = await serviceClient
    .rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!roleData) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const { action, host_id } = body;

  // List ALL payout accounts (verified and pending) with profile info.
  // No server-side status filtering — the admin panel filters client-side.
  if (action === "list") {
    const { data, error: fetchError } = await serviceClient
      .from("host_payout_accounts")
      .select("id, host_id, payout_method, account_holder_name, is_verified, verified_by, verified_at, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (fetchError) return json({ error: fetchError.message }, 500);

    // Attach display names from profiles
    const hostIds = (data ?? []).map((r: { host_id: string }) => r.host_id);
    const { data: profiles } = hostIds.length
      ? await serviceClient.from("profiles").select("user_id, display_name").in("user_id", hostIds)
      : { data: [] };

    const profileMap: Record<string, string> = {};
    for (const p of profiles ?? []) profileMap[p.user_id] = p.display_name;

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      display_name: profileMap[r.host_id as string] ?? "Unknown host",
    }));

    return json({ data: rows });
  }

  // Approve a payout account
  if (action === "approve") {
    if (!host_id) return json({ error: "host_id is required" }, 400);

    const { error: updateError } = await serviceClient
      .from("host_payout_accounts")
      .update({
        is_verified: true,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("host_id", host_id);

    if (updateError) return json({ error: updateError.message }, 500);
    return json({ success: true });
  }

  return json({ error: "Invalid action. Use 'list' or 'approve'." }, 400);
});
