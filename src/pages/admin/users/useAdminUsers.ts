import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FunctionsHttpError } from "@supabase/supabase-js";
import type { ListUsersRequest, ListUsersResponse, RoleScope, ScopeState } from "./types";

async function fetchAdminUsers(payload: ListUsersRequest): Promise<ListUsersResponse> {
  const { data, error } = await supabase.functions.invoke<ListUsersResponse>(
    "admin-list-users",
    { body: payload },
  );
  if (error) {
    let msg = error.message;
    try {
      const body = await (error as FunctionsHttpError).context?.json();
      if (body?.error) msg = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!data) throw new Error("Empty response");
  return data;
}

export function useAdminUsers(scope: RoleScope, state: ScopeState) {
  const payload: ListUsersRequest = {
    role_scope: scope,
    search: state.search.trim() || undefined,
    sort_column: state.sortColumn,
    sort_direction: state.sortDirection,
    host_verification: scope === "host" ? state.hostVerification : undefined,
    member_filter: scope === "user" ? state.memberFilter : undefined,
    page: state.page,
    page_size: state.pageSize,
  };
  return useQuery({
    queryKey: ["admin-list-users", payload],
    queryFn: () => fetchAdminUsers(payload),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
