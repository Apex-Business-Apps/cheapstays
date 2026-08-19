/**
 * Edge function: admin-trigger-wallet-reconcile
 *
 * Admin-only manual trigger for the nightly wallet sweep jobs. Wraps
 * `wallet-credit-reconcile` (default) or `wallet-release-sweep` in an
 * auth-guarded shell so admins can force a run from the Payments page
 * without needing the service-role key in their browser.
 *
 * Body: { job?: "reconcile" | "release" }  — defaults to "reconcile".
 * Both target functions are idempotent (their `credit_pending` /
 * `release_to_available` ledger checks prevent double-processing), so
 * safe to smash the button.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const JOB_ROUTES: Record<string, string> = {
  reconcile: "wallet-credit-reconcile",
  release: "wallet-release-sweep",
};

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

  const rl = await rateLimit(`trigger-wallet-job:${user.id}`, 10, 60_000);
  if (!rl.ok) return json(429, { error: "Rate limited — try again in a minute" });

  let body: { job?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const jobKey = body.job ?? "reconcile";
  const target = JOB_ROUTES[jobKey];
  if (!target) return json(400, { error: `Unknown job "${jobKey}". Use "reconcile" or "release".` });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Service credentials missing" });

  const started = Date.now();
  let downstream: Response;
  try {
    downstream = await fetch(`${supabaseUrl}/functions/v1/${target}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch (err) {
    return json(502, { error: `Failed to invoke ${target}: ${(err as Error).message}` });
  }

  const durationMs = Date.now() - started;
  let payload: unknown;
  try { payload = await downstream.json(); }
  catch { payload = { raw: await downstream.text() }; }

  return json(downstream.ok ? 200 : 502, {
    ok: downstream.ok,
    job: jobKey,
    target,
    status: downstream.status,
    duration_ms: durationMs,
    triggered_by: user.id,
    result: payload,
  });
});
