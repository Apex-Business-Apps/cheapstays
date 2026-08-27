import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search as SearchIcon } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Article,
  categoryLabel,
  coverImageUrl,
  listPublishedArticles,
} from "@/lib/articles";
import { useAuth } from "@/hooks/useAuth";
import { isHost, isAdmin } from "@/lib/rbac";
import heroSkyline from "@/assets/city-cebu.jpg";

const ease = [0.22, 1, 0.36, 1] as const;
const PAGE_SIZE = 8;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ArticlesPage() {
  const [params, setParams] = useSearchParams();
  const initialSearch = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [rows, setRows] = useState<Article[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { roles } = useAuth();
  const canWrite = isHost(roles) || isAdmin(roles);

  const activeSearch = params.get("search") ?? "";

  useEffect(() => {
    setSearchInput(activeSearch);
  }, [activeSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await listPublishedArticles({
          search: activeSearch,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (!cancelled) {
          setRows(res.rows);
          setCount(res.count);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSearch]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (searchInput.trim()) next.set("search", searchInput.trim());
    else next.delete("search");
    setParams(next, { replace: true });
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await listPublishedArticles({
        search: activeSearch,
        limit: PAGE_SIZE,
        offset: rows.length,
      });
      setRows((r) => [...r, ...res.rows]);
      setCount(res.count);
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = rows.length < count;
  const showEmpty = !loading && rows.length === 0;

  const seoTitle = useMemo(
    () =>
      activeSearch
        ? `Search "${activeSearch}" · Articles · CheapStays`
        : "Articles & Guides · CheapStays",
    [activeSearch],
  );

  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title={seoTitle}
        description="Travel tips, city stories, and smarter ways to stay in Metro Manila. Guides from the CheapStays team and partner hosts."
        path="/articles"
      />

      {/* Hero — same warm-marketplace pattern as /about and /customer-support:
          copy on the left, skyline photo on the right with a cream fade at lg+.
          Below lg the photo is full-bleed behind centered copy with a scrim. */}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 overflow-hidden lg:hidden">
          <img
            src={heroSkyline}
            alt=""
            aria-hidden
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-black/55" />
        </div>

        <div className="relative lg:grid lg:grid-cols-[1.05fr_1fr] lg:min-h-[52dvh]">
          <div className="relative z-10 flex flex-col justify-center items-center lg:items-start text-center lg:text-left px-6 sm:px-10 lg:px-16 py-16 lg:py-20 min-h-[62dvh] lg:min-h-0 mx-auto lg:mx-0 w-full max-w-[720px]">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
              className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white lg:text-foreground leading-[1.05]"
            >
              Articles &amp; Guides
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease }}
              className="mt-4 max-w-md text-base text-white/85 lg:text-muted-foreground"
            >
              Travel tips, city stories, and smarter ways to stay in Metro Manila.
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease }}
              onSubmit={submitSearch}
              className="mt-8 flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.35)] w-full max-w-lg"
              role="search"
              aria-label="Search articles"
            >
              <SearchIcon className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search articles..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/70 px-0"
                aria-label="Search articles"
              />
            </motion.form>
          </div>

          <div className="hidden lg:block relative overflow-hidden">
            <img
              src={heroSkyline}
              alt="Metro Manila skyline of high-rise condominiums at sunset"
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent"
            />
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="container py-12 md:py-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {activeSearch ? `Results for "${activeSearch}"` : "Latest Articles"}
          </h2>
          {canWrite && (
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link to="/articles/new">Write an article</Link>
            </Button>
          )}
        </div>

        {loading ? (
          <ArticleGridSkeleton />
        ) : showEmpty ? (
          <EmptyState hasSearch={!!activeSearch} />
        ) : (
          <div className="grid gap-6 md:gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((a, idx) => (
              <ArticleCard key={a.id} article={a} index={idx} />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-10 flex justify-center">
            <Button
              variant="outline"
              className="rounded-xl px-6"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more articles"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const cover = coverImageUrl(article.cover_path);
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.04, ease }}
      className="group"
    >
      <Link
        to={`/articles/${article.url_id}`}
        className="block rounded-2xl overflow-hidden bg-card border border-border/60 transition-shadow duration-300 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.4)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/60">
          {cover ? (
            <img
              src={cover}
              alt={article.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
        </div>
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {categoryLabel(article.category)}
          </p>
          <h3 className="mt-2 text-base md:text-lg font-semibold text-foreground leading-snug line-clamp-2">
            {article.title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {article.excerpt}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            {formatDate(article.published_at)} &nbsp;·&nbsp; {article.read_minutes} min read
          </p>
        </div>
      </Link>
    </motion.article>
  );
}

function ArticleGridSkeleton() {
  return (
    <div className="grid gap-6 md:gap-7 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/60">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="p-5 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="rounded-3xl bg-card border border-border/60 p-10 md:p-14 text-center">
      <h3 className="text-lg md:text-xl font-semibold text-foreground">
        {hasSearch ? "No articles matched your search." : "No articles yet."}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {hasSearch
          ? "Try a different keyword, or clear your search to browse everything."
          : "Check back soon. Our team and partner hosts publish new guides regularly."}
      </p>
    </div>
  );
}
