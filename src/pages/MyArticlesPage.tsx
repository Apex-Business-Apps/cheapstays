import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import {
  Article,
  categoryLabel,
  coverImageUrl,
  listMyArticles,
} from "@/lib/articles";

// The generated Database type does not yet include the `articles` table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Author-side article management. Mounted at /host/articles and /admin/articles.
 * Hosts see their own rows; admins see everything so they can moderate.
 */
export default function MyArticlesPage() {
  const { user, roles } = useAuth();
  const admin = isAdmin(roles);
  const [rows, setRows] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = admin
          ? ((await db
              .from("articles")
              .select("*")
              .order("updated_at", { ascending: false })).data as Article[]) ?? []
          : await listMyArticles(user.id);
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, admin]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {admin ? "All Articles" : "My Articles"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {admin
              ? "Every article on CheapStays. You can edit or unpublish anything."
              : "Drafts and published guides you have written."}
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to="/articles/new">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden />
            New article
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">No articles yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Share travel tips or a city guide. Drafts stay private until you publish them.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/articles/new">Write your first article</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((a) => (
            <Row key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ article }: { article: Article }) {
  const cover = coverImageUrl(article.cover_path);
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card border border-border/60 p-3 md:p-4">
      <div className="relative h-16 w-24 md:h-20 md:w-32 shrink-0 overflow-hidden rounded-lg bg-muted/60">
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">
            No cover
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={article.status === "published" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {article.status === "published" ? "Published" : "Draft"}
          </Badge>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {categoryLabel(article.category)}
          </span>
        </div>
        <Link
          to={`/articles/${article.url_id}`}
          className="mt-1 block text-sm md:text-base font-semibold text-foreground hover:underline underline-offset-4 truncate"
        >
          {article.title || "Untitled"}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {article.status === "published"
            ? `Published ${formatDate(article.published_at)}`
            : `Last edited ${formatDate(article.updated_at)}`}{" "}
          · {article.read_minutes} min read
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="rounded-xl shrink-0">
        <Link to={`/articles/${article.url_id}/edit`}>
          <Pencil className="h-4 w-4 mr-1.5" aria-hidden />
          Edit
        </Link>
      </Button>
    </div>
  );
}
