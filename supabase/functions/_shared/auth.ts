import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null, supabase: null, error: "Missing auth" };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { user: null, supabase: null, error: "Unauthorized" };
  return { user: { id: data.user.id, email: data.user.email }, supabase, error: null };
}
