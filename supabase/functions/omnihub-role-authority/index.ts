import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { verifyOmniHubCommand } from "../_shared/command-authority.ts";
import { omniportEmit } from "../_shared/omniport.ts";

const OPERATIONS = [
  "grant_host",
  "revoke_host",
  "grant_admin",
  "revoke_admin",
  "suspend_user",
  "reinstate_user",
  "emergency_lockout",
] as const;

const MutationSchema = z.object({
  command_id:     z.string().min(1),
  command_source: z.string().min(1),
  requester_id:   z.string().uuid(),
  approver_id:    z.string().uuid(),
  operation:      z.enum(OPERATIONS),
  target_user_id: z.string().uuid(),
  reason_code:    z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`omnihub-role-authority:${ip}`, 20, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must be authenticated
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

    // Caller must hold the admin role
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = MutationSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = parsed.data;

    // Verify the command is approved in the OmniHub / GitHub registry
    const commandValid = await verifyOmniHubCommand(payload.command_id, {
      source:    payload.command_source,
      operation: payload.operation,
    });
    if (!commandValid) {
      return new Response(
        JSON.stringify({
          error:      "Command not found in registry, not approved, or expired",
          command_id: payload.command_id,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Execute via SECURITY DEFINER DB function (handles replay prevention + audit)
    const { data: result, error: rpcErr } = await adminClient.rpc("execute_role_mutation", {
      p_command_id:     payload.command_id,
      p_command_source: payload.command_source,
      p_requester_id:   payload.requester_id,
      p_approver_id:    payload.approver_id,
      p_operation:      payload.operation,
      p_target_user_id: payload.target_user_id,
      p_reason_code:    payload.reason_code,
      p_executed_by:    user.id,
      p_ip_address:     ip,
    });

    if (rpcErr) {
      return new Response(
        JSON.stringify({ error: "Role mutation failed", detail: rpcErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Emit to OmniHub audit stream (best-effort, non-blocking)
    await omniportEmit("audit_events", {
      event:       "role_mutation",
      executed_by: user.id,
      ...result,
    });

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
