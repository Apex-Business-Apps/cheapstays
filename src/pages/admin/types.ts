import type { AppRole } from "@/lib/rbac";

export type Booking = {
  id: string; listing_id: string; guest_id: string; host_id: string;
  check_in: string; check_out: string; status: string; total_php: number; created_at: string;
};

export type SupportTicket = {
  id: string; ticket_num: number; subject: string; status: string;
  priority: string; category: string; escalated: boolean; created_at: string; user_id: string;
};

export type TicketMessage = { id: string; sender: string; content: string; created_at: string };
export type TicketStatus  = "open" | "pending" | "resolved" | "closed" | "escalated";
export type UserRoleRow   = { id: string; user_id: string; role: AppRole };
export type ProfileRow    = { user_id: string; display_name: string | null };
export type AuditRow      = {
  id: string; command_id: string; command_source: string;
  operation: string; target_user_id: string; reason_code: string;
  before_state: Record<string, unknown>; after_state: Record<string, unknown>;
  executed_by: string | null; created_at: string;
};
export type UserView = { userId: string; displayName: string; initials: string; roles: AppRole[] };
export type HostApp = {
  id: string; user_id: string; full_legal_name: string; phone: string;
  property_type: string; city: string; province: string; property_description: string;
  id_type: string; id_front_path: string | null; selfie_path: string | null;
  status: string; created_at: string;
};

export const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500", pending: "bg-amber-400",
  cancelled: "bg-red-400", completed: "bg-blue-400", no_show: "bg-gray-400",
};

export const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive", high: "secondary", normal: "outline", low: "outline",
};

export const TICKET_STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed", "escalated"];

export const SENDER_LABEL: Record<string, string> = {
  user: "User", admin: "Admin", ai: "AI Assistant", system: "System",
};

export function buildUserViews(roles: UserRoleRow[], profiles: ProfileRow[]): UserView[] {
  const roleMap = new Map<string, Set<AppRole>>();
  for (const row of roles) {
    if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, new Set());
    roleMap.get(row.user_id)?.add(row.role);
  }
  return profiles.map((p) => {
    const assigned = Array.from(roleMap.get(p.user_id) ?? new Set<AppRole>(["user"]));
    const label    = p.display_name?.trim() || p.user_id.slice(0, 8);
    const initials = label.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
    return { userId: p.user_id, displayName: label, initials, roles: assigned as AppRole[] };
  });
}
