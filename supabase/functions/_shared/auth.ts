import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null, supabase: null, error: "Missing auth" };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return { user: null, supabase: null, error: "Unauthorized" };
  return { user: { id: data.claims.sub as string, email: data.claims.email as string | undefined }, supabase, error: null };
}
