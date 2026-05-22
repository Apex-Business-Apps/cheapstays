import { createClient } from "npm:@supabase/supabase-js@2";

export type RoleOperation =
  | "grant_host"
  | "revoke_host"
  | "grant_admin"
  | "revoke_admin"
  | "suspend_user"
  | "reinstate_user"
  | "emergency_lockout";

export interface OmniHubCommandCheck {
  source:    string;
  operation: RoleOperation;
}

/** Legacy helper — checks only that a command is approved and from "github". */
export async function isApprovedRegistryCommand(commandId: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await supabase
    .from("github_command_registry")
    .select("id, approved, source")
    .eq("id", commandId)
    .eq("approved", true)
    .eq("source", "github")
    .maybeSingle();
  return !!data;
}

/**
 * Full OmniHub command verification:
 * - Command must exist and be approved.
 * - Source must match the declared source.
 * - Command must not have expired.
 * - If the command has a command_type in metadata, it must match the operation.
 */
export async function verifyOmniHubCommand(
  commandId: string,
  check: OmniHubCommandCheck,
): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data } = await supabase
    .from("github_command_registry")
    .select("id, approved, source, command_type, expires_at, metadata")
    .eq("id", commandId)
    .eq("approved", true)
    .maybeSingle();

  if (!data) return false;
  if (data.source !== check.source) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;

  // If the registry entry scopes to a specific operation, enforce it
  const scopedOp = data.command_type ?? (data.metadata as Record<string, unknown>)?.operation;
  if (scopedOp && scopedOp !== check.operation) return false;

  return true;
}
