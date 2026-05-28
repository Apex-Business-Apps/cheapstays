import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { dispatchNotification } from "../_shared/notify.ts";

const BodySchema = z.object({
  ticket_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`approve-host-via-ticket:${ip}`, 20, 60_000);
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

    const { ticket_id } = parsed.data;
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin.
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the ticket.
    const { data: ticket, error: ticketErr } = await adminClient
      .from("support_tickets")
      .select("id, user_id, category, status")
      .eq("id", ticket_id)
      .single();

    if (ticketErr || !ticket) {
      return new Response(JSON.stringify({ error: "Support ticket not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticket.category !== "host_verification") {
      return new Response(JSON.stringify({ error: "Ticket is not a host verification request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target_user_id: string = ticket.user_id;

    // Idempotent: if already a host, just resolve the ticket.
    const { data: alreadyHost } = await adminClient.rpc("has_role", { _user_id: target_user_id, _role: "host" });
    if (alreadyHost) {
      await adminClient.from("support_tickets").update({ status: "resolved" }).eq("id", ticket_id);
      return new Response(
        JSON.stringify({ success: true, target_user_id, already_host: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Grant host role via service role — no self-grant restriction here because
    // this is a legitimate admin-initiated approval flow, not raw role mutation.
    const { error: roleErr } = await adminClient
      .from("user_roles")
      .insert({ user_id: target_user_id, role: "host", granted_by: user.id });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) throw roleErr;

    // Confirm the grant persisted.
    const { data: confirmed } = await adminClient.rpc("has_role", { _user_id: target_user_id, _role: "host" });
    if (!confirmed) throw new Error("Host role grant did not persist — state mismatch after write");

    // Mark host_profiles as verified so the dashboard shows the correct status.
    const { error: profileErr } = await adminClient.from("host_profiles").upsert(
      {
        user_id: target_user_id,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        id_photo_url: null,
        selfie_url: null,
      },
      { onConflict: "user_id" },
    );
    if (profileErr) throw profileErr;

    // Immutable audit record.
    const commandId = `approve-host-via-ticket:${ticket_id}:${Date.now()}`;
    const { error: auditErr } = await adminClient.from("role_mutation_audit").insert({
      command_id: commandId,
      command_source: "approve-host-via-ticket",
      requester_id: user.id,
      approver_id: user.id,
      operation: "grant_host",
      target_user_id,
      reason_code: "host-verification-support-ticket",
      before_state: { host_status: false, ticket_id },
      after_state: { host_status: true, ticket_id },
      executed_by: user.id,
      ip_address: ip,
    });
    if (auditErr) throw auditErr;

    // Resolve the ticket now that approval is confirmed.
    const { error: statusErr } = await adminClient
      .from("support_tickets")
      .update({ status: "resolved" })
      .eq("id", ticket_id);
    if (statusErr) throw statusErr;

    // Notify the applicant.
    await dispatchNotification(adminClient, {
      userId: target_user_id,
      type: "host_status_approved",
      title: "Host application approved!",
      body: "Your host profile is approved. You can now publish listings and accept bookings.",
      data: { ticket_id },
      url: "/host",
    });

    return new Response(
      JSON.stringify({ success: true, target_user_id, ticket_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
