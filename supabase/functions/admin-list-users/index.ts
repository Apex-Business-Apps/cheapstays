import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const SortColumn = z.enum(["joined_at", "display_name", "last_sign_in_at", "verified_at"]);
const SortDirection = z.enum(["asc", "desc"]);

const BodySchema = z.object({
  role_scope: z.enum(["admin", "host", "user"]),
  search: z.string().max(120).optional(),
  sort_column: SortColumn.optional(),
  sort_direction: SortDirection.optional(),
  host_verification: z.enum(["all", "verified", "pending", "unverified", "rejected"]).optional(),
  member_filter: z.enum(["all", "members", "plain"]).optional(),
  page: z.number().int().min(1).max(10_000).default(1),
  page_size: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
});

type AppRole = "admin" | "host" | "member" | "user";

type UserRow = {
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) return json({ error: authErr ?? "Unauthorized" }, 401);

    const rl = await rateLimit(`admin-list-users:${user.id}`, 60, 60_000);
    if (!rl.ok) return json({ error: "Rate limit exceeded" }, 429);

    let body: unknown;
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const {
      role_scope, search, sort_column, sort_direction,
      host_verification, member_filter, page, page_size,
    } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    // 1. Resolve target user_id set based on role scope.
    const { data: allRolesRaw, error: rolesErr } = await admin
      .from("user_roles")
      .select("user_id, role, granted_by, created_at");
    if (rolesErr) throw rolesErr;
    const allRoles = (allRolesRaw ?? []) as {
      user_id: string; role: AppRole; granted_by: string | null; created_at: string;
    }[];

    const rolesByUser = new Map<string, { role: AppRole; granted_by: string | null; created_at: string }[]>();
    for (const r of allRoles) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push({ role: r.role, granted_by: r.granted_by, created_at: r.created_at });
      rolesByUser.set(r.user_id, list);
    }

    // Either an explicit include set (targetIds) OR an exclude set (excludeIds).
    let targetIds: Set<string> | null = null;
    let excludeIds: Set<string> | null = null;
    if (role_scope === "admin") {
      targetIds = new Set(allRoles.filter((r) => r.role === "admin").map((r) => r.user_id));
    } else if (role_scope === "host") {
      targetIds = new Set(allRoles.filter((r) => r.role === "host").map((r) => r.user_id));
    } else {
      // user scope: everyone not in admin/host
      const excluded = new Set(
        allRoles.filter((r) => r.role === "admin" || r.role === "host").map((r) => r.user_id),
      );
      if (member_filter === "members") {
        targetIds = new Set(
          allRoles.filter((r) => r.role === "member" && !excluded.has(r.user_id)).map((r) => r.user_id),
        );
      } else if (member_filter === "plain") {
        // Users with NO user_roles row at all.
        excludeIds = new Set(allRoles.map((r) => r.user_id));
      } else {
        // all users in user scope = profiles not admin, not host (may or may not be member)
        excludeIds = excluded;
      }
    }

    // 2. Optional: email search → resolve auth.users ids first.
    let emailMatchIds: Set<string> | null = null;
    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const { data: emailMatches } = await admin
        .schema("auth")
        .from("users")
        .select("id")
        .ilike("email", `%${trimmedSearch}%`)
        .limit(500);
      emailMatchIds = new Set(((emailMatches ?? []) as { id: string }[]).map((u) => u.id));
    }

    // 3. Build the profiles query.
    let q = admin
      .from("profiles")
      .select("user_id, display_name, avatar_url, created_at", { count: "exact" });

    if (targetIds) {
      const ids = Array.from(targetIds);
      if (ids.length === 0) return json({ rows: [], total: 0 });
      q = q.in("user_id", ids);
    } else if (excludeIds && excludeIds.size > 0) {
      // Postgres NOT IN accepts a comma-separated list wrapped in parens.
      q = q.not("user_id", "in", `(${Array.from(excludeIds).map((id) => `"${id}"`).join(",")})`);
    }

    if (trimmedSearch) {
      // Match display_name OR (already-resolved email ids).
      const emailIds = emailMatchIds ? Array.from(emailMatchIds) : [];
      if (emailIds.length > 0) {
        const escaped = trimmedSearch.replace(/[%_,]/g, (m) => `\\${m}`);
        q = q.or(
          `display_name.ilike.%${escaped}%,user_id.in.(${emailIds.map((id) => `"${id}"`).join(",")})`,
        );
      } else {
        q = q.ilike("display_name", `%${trimmedSearch}%`);
      }
    }

    // 4. Sort.
    const sortCol = sort_column ?? "joined_at";
    const sortDir = sort_direction ?? "desc";
    if (sortCol === "joined_at") q = q.order("created_at", { ascending: sortDir === "asc" });
    else if (sortCol === "display_name") q = q.order("display_name", { ascending: sortDir === "asc", nullsFirst: false });
    // last_sign_in_at and verified_at are not on profiles → sorted client-side after enrichment.

    // 5. Paginate.
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;
    q = q.range(from, to);

    const { data: profiles, error: profErr, count } = await q;
    if (profErr) throw profErr;
    const profileRows = (profiles ?? []) as {
      user_id: string; display_name: string | null;
      avatar_url: string | null; created_at: string;
    }[];

    if (profileRows.length === 0) return json({ rows: [], total: count ?? 0 });

    const pageUserIds = profileRows.map((p) => p.user_id);

    // 6. Enrich with auth.users (email, last_sign_in_at).
    const { data: authRows } = await admin
      .schema("auth")
      .from("users")
      .select("id, email, last_sign_in_at")
      .in("id", pageUserIds);
    const authMap = new Map<string, { email: string | null; last_sign_in_at: string | null }>();
    for (const a of (authRows ?? []) as { id: string; email: string | null; last_sign_in_at: string | null }[]) {
      authMap.set(a.id, { email: a.email, last_sign_in_at: a.last_sign_in_at });
    }

    // 7. Scope-specific enrichment.
    const hostMap = new Map<string, {
      verification_status: string | null; verified_at: string | null;
      total_listings: number | null; total_bookings: number | null;
    }>();
    if (role_scope === "host") {
      const { data: hostRows } = await admin
        .from("host_profiles")
        .select("user_id, verification_status, verified_at, total_listings, total_bookings")
        .in("user_id", pageUserIds);
      for (const h of (hostRows ?? []) as {
        user_id: string; verification_status: string | null; verified_at: string | null;
        total_listings: number | null; total_bookings: number | null;
      }[]) {
        hostMap.set(h.user_id, {
          verification_status: h.verification_status,
          verified_at: h.verified_at,
          total_listings: h.total_listings,
          total_bookings: h.total_bookings,
        });
      }
    }

    const granterMap = new Map<string, string | null>();
    if (role_scope === "admin") {
      const granterIds = Array.from(
        new Set(
          pageUserIds
            .flatMap((uid) => rolesByUser.get(uid) ?? [])
            .filter((r) => r.role === "admin" && r.granted_by)
            .map((r) => r.granted_by as string),
        ),
      );
      if (granterIds.length > 0) {
        const { data: granters } = await admin
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", granterIds);
        for (const g of (granters ?? []) as { user_id: string; display_name: string | null }[]) {
          granterMap.set(g.user_id, g.display_name);
        }
      }
    }

    // 8. Assemble rows.
    let rows: UserRow[] = profileRows.map((p) => {
      const roles = (rolesByUser.get(p.user_id) ?? []).map((r) => r.role);
      const effectiveRoles: AppRole[] = roles.length > 0 ? Array.from(new Set(roles)) : ["user"];
      const auth = authMap.get(p.user_id);
      const row: UserRow = {
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        email: auth?.email ?? null,
        roles: effectiveRoles,
        joined_at: p.created_at,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
      };
      if (role_scope === "host") {
        const h = hostMap.get(p.user_id);
        row.host_verification_status = h?.verification_status ?? "unverified";
        row.verified_at = h?.verified_at ?? null;
        row.total_listings = h?.total_listings ?? 0;
        row.total_bookings = h?.total_bookings ?? 0;
      }
      if (role_scope === "admin") {
        const adminGrant = (rolesByUser.get(p.user_id) ?? []).find((r) => r.role === "admin");
        row.admin_granted_at = adminGrant?.created_at ?? null;
        row.admin_granted_by_name = adminGrant?.granted_by
          ? granterMap.get(adminGrant.granted_by) ?? null
          : null;
      }
      return row;
    });

    // 9. Host-scope verification filter is applied post-enrichment.
    if (role_scope === "host" && host_verification && host_verification !== "all") {
      rows = rows.filter((r) => (r.host_verification_status ?? "unverified") === host_verification);
    }

    // 10. Client-side sort for enrichment-only columns.
    if (sortCol === "last_sign_in_at") {
      rows.sort((a, b) => {
        const av = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
        const bv = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    } else if (sortCol === "verified_at") {
      rows.sort((a, b) => {
        const av = a.verified_at ? new Date(a.verified_at).getTime() : 0;
        const bv = b.verified_at ? new Date(b.verified_at).getTime() : 0;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }

    return json({ rows, total: count ?? rows.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
