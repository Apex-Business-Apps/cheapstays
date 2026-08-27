import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Pencil } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArticleBody } from "@/components/articles/ArticleBody";
import {
  Article,
  categoryLabel,
  coverImageUrl,
  getArticleByUrlId,
  listRelatedArticles,
} from "@/lib/articles";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/rbac";

const ease = [0.22, 1, 0.36, 1] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const a = await getArticleByUrlId(articleId);
        if (cancelled) return;
        if (!a) {
          setNotFound(true);
          return;
        }
        setArticle(a);
        const rel = await listRelatedArticles(a, 3);
        if (!cancelled) setRelated(rel);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (loading) return <DetailSkeleton />;
  if (notFound || !article) return <NotFoundBlock />;

  const cover = coverImageUrl(article.cover_path);
  const canEdit = user && (user.id === article.author_id || isAdmin(roles));
  const isDraft = article.status === "draft";

  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title={`${article.title} · CheapStays`}
        description={article.excerpt || article.title}
        path={`/articles/${article.url_id}`}
        image={cover ?? undefined}
      />

      <article className="container max-w-3xl py-10 md:py-16">
        <div className="flex items-center justify-between gap-3 mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          {canEdit && (
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link to={`/articles/${article.url_id}/edit`}>
                <Pencil className="h-4 w-4 mr-1.5" aria-hidden />
                Edit
              </Link>
            </Button>
          )}
        </div>

        {isDraft && (
          <div className="mb-6 rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Draft. Only you and admins can see this preview until you publish it.
          </div>
        )}

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary"
        >
          {categoryLabel(article.category)}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease }}
          className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.05]"
        >
          {article.title}
        </motion.h1>

        <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{formatDate(article.published_at ?? article.created_at)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {article.read_minutes} min read
          </span>
        </div>

        {cover && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="mt-8 md:mt-10 overflow-hidden rounded-2xl border border-border/60 bg-muted/40"
          >
            <img
              src={cover}
              alt={article.title}
              loading="eager"
              className="w-full h-auto object-cover aspect-[16/9]"
            />
          </motion.div>
        )}

        {article.excerpt && (
          <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
            {article.excerpt}
          </p>
        )}

        <div className="mt-8">
          <ArticleBody html={article.body_html} />
        </div>
      </article>

      {related.length > 0 && (
        <section className="container pb-16 md:pb-24">
          <div className="border-t border-border/60 pt-10 md:pt-14">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-6">
              More {categoryLabel(article.category)}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <RelatedCard key={r.id} article={r} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function RelatedCard({ article }: { article: Article }) {
  const cover = coverImageUrl(article.cover_path);
  return (
    <Link
      to={`/articles/${article.url_id}`}
      className="group block rounded-2xl overflow-hidden bg-card border border-border/60 transition-shadow duration-300 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.4)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/60">
        {cover ? (
          <img
            src={cover}
            alt={article.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : null}
      </div>
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {categoryLabel(article.category)}
        </p>
        <h3 className="mt-2 text-base font-semibold text-foreground line-clamp-2">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="container max-w-3xl py-16">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-3/4 mt-4" />
      <Skeleton className="h-4 w-40 mt-4" />
      <Skeleton className="aspect-[16/9] w-full mt-8 rounded-2xl" />
      <Skeleton className="h-4 w-full mt-8" />
      <Skeleton className="h-4 w-11/12 mt-3" />
      <Skeleton className="h-4 w-10/12 mt-3" />
    </div>
  );
}

function NotFoundBlock() {
  return (
    <div className="container max-w-2xl py-24 text-center">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
        Article not found
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This article may have been unpublished or the link is incorrect.
      </p>
      <Button asChild className="mt-6 rounded-xl">
        <Link to="/articles">Back to all articles</Link>
      </Button>
    </div>
  );
}
