import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const BodySchema = z.object({
  target_user_id: z.string().uuid(),
  operation: z.enum(["grant", "revoke"]),
  reason_code: z.string().min(1).max(200),
  reviewer_notes: z.string().max(1000).optional().default(""),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = rateLimit(`grant-host-role:${ip}`, 20, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, operation, reason_code, reviewer_notes } = parsed.data;
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Caller must be an admin.
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent an admin from modifying their own role via this endpoint.
    if (user.id === target_user_id) {
      return new Response(JSON.stringify({ error: "Admins cannot modify their own role through this endpoint" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: currentlyHost } = await adminClient.rpc("has_role", { _user_id: target_user_id, _role: "host" });

    if (operation === "grant") {
      if (currentlyHost) {
        return new Response(JSON.stringify({ error: "User already has host role" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .insert({ user_id: target_user_id, role: "host", granted_by: user.id });
      if (roleErr) throw roleErr;
    } else {
      if (!currentlyHost) {
        return new Response(JSON.stringify({ error: "User does not have host role" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id)
        .eq("role", "host");
      if (roleErr) throw roleErr;
    }

    // Confirm the operation landed before writing the audit entry.
    const { data: confirmedHost } = await adminClient.rpc("has_role", { _user_id: target_user_id, _role: "host" });
    const expectedState = operation === "grant";
    if (confirmedHost !== expectedState) {
      throw new Error(`Role ${operation} did not apply — state mismatch after write`);
    }

    const commandId = `grant-host-role:${operation}:${target_user_id}:${Date.now()}`;
    const { error: auditErr } = await adminClient.from("role_mutation_audit").insert({
      command_id: commandId,
      command_source: "grant-host-role",
      requester_id: user.id,
      approver_id: user.id,
      operation: operation === "grant" ? "grant_host" : "revoke_host",
      target_user_id,
      reason_code,
      before_state: { host_status: !expectedState, reviewer_notes },
      after_state: { host_status: expectedState, reviewer_notes },
      executed_by: user.id,
      ip_address: ip,
    });
    if (auditErr) throw auditErr;

    return new Response(
      JSON.stringify({ success: true, target_user_id, operation, host_status: expectedState }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
