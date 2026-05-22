import { createClient } from "npm:@supabase/supabase-js@2";

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
