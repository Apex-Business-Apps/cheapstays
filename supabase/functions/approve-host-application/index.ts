import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { dispatchNotification } from "../_shared/notify.ts";

const BodySchema = z.object({
  application_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  reason_code: z.string().min(1).max(200),
  reviewer_notes: z.string().max(1000).optional().default(""),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`approve-host-application:${ip}`, 30, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { application_id, target_user_id, reason_code, reviewer_notes } = parsed.data;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: app, error: appErr } = await adminClient
      .from("host_applications")
      .select("id,user_id,status,id_front_path,selfie_path")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Host application not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (app.user_id !== target_user_id) {
      return new Response(JSON.stringify({ error: "Target user does not match host application" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!["pending", "manual_review"].includes(app.status)) {
      return new Response(JSON.stringify({ error: `Application status ${app.status} is not approvable` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!app.id_front_path || !app.selfie_path) {
      return new Response(JSON.stringify({ error: "Missing required evidence: ID and selfie are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: alreadyHost } = await adminClient.rpc("has_role", { _user_id: target_user_id, _role: "host" });
    if (alreadyHost) {
      return new Response(JSON.stringify({ error: "User is already a host" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: roleErr } = await adminClient.from("user_roles").insert({ user_id: target_user_id, role: "host", granted_by: user.id });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw roleErr;
    }

    const { error: updateErr } = await adminClient.from("host_applications").update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    }).eq("id", application_id);
    if (updateErr) throw updateErr;

    const { data: hostConfirmed } = await adminClient.rpc("has_role", { _user_id: target_user_id, _role: "host" });
    if (!hostConfirmed) {
      return new Response(JSON.stringify({ error: "Host status was not confirmed after approval" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const commandId = `approve-host-application:${application_id}:${Date.now()}`;
    await adminClient.from("role_mutation_audit").insert({
      command_id: commandId,
      command_source: "approve-host-application",
      requester_id: user.id,
      approver_id: user.id,
      operation: "grant_host",
      target_user_id,
      reason_code,
      before_state: { host_status: false, application_id, reviewer_notes },
      after_state: { host_status: true, application_id, reviewer_notes },
      executed_by: user.id,
      ip_address: ip,
    });

    // Notify the applicant their host status is approved (push eligible — high-value event)
    await dispatchNotification(adminClient, {
      userId: target_user_id,
      type: "host_status_approved",
      title: "Host application approved!",
      body: "Your host profile is approved. You can now publish listings and accept bookings.",
      data: { application_id },
      url: "/host",
    });

    return new Response(JSON.stringify({ success: true, application_id, target_user_id, host_status: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
