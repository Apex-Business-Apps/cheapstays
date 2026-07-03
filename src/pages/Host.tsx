// src/pages/Host.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isHost } from "@/lib/rbac";
import { Loader2 } from "lucide-react";

export default function Host() {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isHost(roles)) return <Navigate to="/host/dashboard" replace />;
  return <Navigate to="/host/apply" replace />;
}
