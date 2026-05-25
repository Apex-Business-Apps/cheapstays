import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/rbac";

export function RoleGate({
  role,
  children,
  fallback = null,
}: {
  role: AppRole;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  const ok = roles.includes(role) || roles.includes("admin");
  return <>{ok ? children : fallback}</>;
}
