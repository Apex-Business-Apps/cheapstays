import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "host" | "member" | "user";

export async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r) => r.role as AppRole);
}

export function hasRole(roles: AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}

export function isAdmin(roles: AppRole[]) {
  return hasRole(roles, "admin");
}
export function isHost(roles: AppRole[]) {
  return hasRole(roles, "host") || isAdmin(roles);
}
export function isMember(roles: AppRole[]) {
  return hasRole(roles, "member") || isAdmin(roles);
}
