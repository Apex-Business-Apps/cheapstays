import { createClient } from "npm:@supabase/supabase-js@2";

export type AuditDecision = "allowed" | "blocked" | "review_required";

export async function logAiDecision(params: {
  surface: string;
  decision: AuditDecision;
  actor_id?: string | null;
  prompt_version: string;
  reason: string;
  payload?: Record<string, unknown>;
}) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("ai_audit_logs").insert({
      surface: params.surface,
      decision: params.decision,
      actor_id: params.actor_id ?? null,
      prompt_version: params.prompt_version,
      reason: params.reason,
      payload: params.payload ?? {},
    });
  } catch {
    // Do not fail primary UX for telemetry failures.
  }
}
