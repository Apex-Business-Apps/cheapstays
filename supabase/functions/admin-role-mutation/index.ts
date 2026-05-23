import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { omniportEmit } from "../_shared/omniport.ts";
import type { RoleOperation } from "../_shared/command-authority.ts";

const OPERATIONS: RoleOperation[] = [
  "grant_host", "revoke_host",
  "grant_admin", "revoke_admin",
  "suspend_user", "reinstate_user",
  "emergency_lockout",
];

const BodySchema = z.object({
  operation:      z.enum(OPERATIONS as [RoleOperation, ...RoleOperation[]]),
  target_user_id: z.string().uuid(),
  reason_code:    z.string().min(1).max(200),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`admin-role-mutation:${ip}`, 30, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { operation, target_user_id, reason_code } = parsed.data;

    // Auto-generate a one-time admin-ui command and register it
    const commandId = `admin-ui:${crypto.randomUUID()}`;
    await adminClient.from("github_command_registry").insert({
      id: commandId,
      source: "admin-ui",
      approved: true,
      command_type: operation,
    });

    // Execute via the SECURITY DEFINER audit function
    const { data: result, error: rpcErr } = await adminClient.rpc("execute_role_mutation", {
      p_command_id:     commandId,
      p_command_source: "admin-ui",
      p_requester_id:   user.id,
      p_approver_id:    user.id,
      p_operation:      operation,
      p_target_user_id: target_user_id,
      p_reason_code:    reason_code,
      p_executed_by:    user.id,
      p_ip_address:     ip,
    });

    if (rpcErr) {
      return new Response(
        JSON.stringify({ error: "Role mutation failed", detail: rpcErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await omniportEmit("audit_events", { event: "role_mutation", source: "admin-ui", executed_by: user.id, ...result });

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
