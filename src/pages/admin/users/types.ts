import type { AppRole } from "@/lib/rbac";

export type RoleScope = "admin" | "host" | "user";

export type SortColumn = "joined_at" | "display_name" | "last_sign_in_at" | "verified_at";
export type SortDirection = "asc" | "desc";

export type HostVerification = "all" | "verified" | "pending" | "unverified" | "rejected";
export type MemberFilter = "all" | "members" | "plain";

export type AdminUserRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  roles: AppRole[];
  joined_at: string;
  last_sign_in_at: string | null;
  host_verification_status?: string | null;
  verified_at?: string | null;
  total_listings?: number;
  total_bookings?: number;
  admin_granted_at?: string | null;
  admin_granted_by_name?: string | null;
};

export type ListUsersRequest = {
  role_scope: RoleScope;
  search?: string;
  sort_column?: SortColumn;
  sort_direction?: SortDirection;
  host_verification?: HostVerification;
  member_filter?: MemberFilter;
  page: number;
  page_size: 25 | 50 | 100;
};

export type ListUsersResponse = { rows: AdminUserRow[]; total: number };

export type ScopeState = {
  search: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  hostVerification: HostVerification;
  memberFilter: MemberFilter;
  page: number;
  pageSize: 25 | 50 | 100;
};

export const DEFAULT_SCOPE_STATE: ScopeState = {
  search: "",
  sortColumn: "joined_at",
  sortDirection: "desc",
  hostVerification: "all",
  memberFilter: "all",
  page: 1,
  pageSize: 25,
};
