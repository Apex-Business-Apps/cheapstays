// src/pages/admin/UsersPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { UserRoleRow, ProfileRow } from "./types";
import { buildUserViews } from "./types";

export default function UsersPage() {
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from("user_roles").select("id,user_id,role").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,display_name").limit(200),
    ]);
    setUserRoles((rolesRes.data ?? []) as UserRoleRow[]);
    setProfiles((profilesRes.data ?? []) as ProfileRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const users = useMemo(() => buildUserViews(userRoles, profiles), [userRoles, profiles]);
  const filtered = useMemo(() =>
    search.trim() ? users.filter((u) => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.userId.includes(search)) : users,
    [users, search]);

  return (
    <>
      <Seo title="Users · CheapStays Admin" description="User management." path="/admin/users" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Users</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <Input placeholder="Search by name or user ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm h-8 text-sm" />
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6">No users found.</p> : (
            <div className="grid gap-2">
              {filtered.map((u) => (
                <Card key={u.userId} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{u.initials}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium text-sm">{u.displayName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{u.userId.slice(0, 16)}…</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : r === "host" ? "secondary" : "outline"} className="text-[10px] capitalize">{r}</Badge>)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
