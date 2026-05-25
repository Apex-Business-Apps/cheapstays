import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "host" | "member" | "user";

export type FetchRolesResult = {
  roles: AppRole[];
  error: null | {
    code?: string;
    message: string;
  };
};

export async function fetchRoles(userId: string | null | undefined): Promise<FetchRolesResult> {
  if (!userId) {
    // Signed-out users have no roles by design; this is not an error condition.
    return { roles: [], error: null };
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    const structuredError = { code: error.code, message: error.message };
    if (import.meta.env.DEV) {
      console.error("[rbac.fetchRoles.failed]", { userId, ...structuredError });
    }
    return { roles: [], error: structuredError };
  }

  return {
    roles: (data ?? []).map((r) => r.role as AppRole),
    error: null,
  };
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
