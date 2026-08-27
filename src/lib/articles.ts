import { supabase } from "@/integrations/supabase/client";

// The generated `Database` type is regenerated from Supabase and does not yet
// include the `articles` table this migration introduces. Rather than hand-edit
// the generated file (per project convention), we cast the client to a loose
// shape scoped to this data-access module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const ARTICLE_CATEGORIES = [
  { value: "where_to_stay", label: "Where to Stay" },
  { value: "travel_tips",   label: "Travel Tips" },
  { value: "stay_smarter",  label: "Stay Smarter" },
  { value: "things_to_do",  label: "Things to Do" },
  { value: "city_living",   label: "City Living" },
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]["value"];

export type Article = {
  id: string;
  url_id: string;
  author_id: string;
  title: string;
  excerpt: string;
  body_html: string;
  cover_path: string | null;
  category: ArticleCategory;
  read_minutes: number;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function categoryLabel(value: string): string {
  return ARTICLE_CATEGORIES.find((c) => c.value === value)?.label ?? "Article";
}

export function coverImageUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("article-covers").getPublicUrl(path);
  return data.publicUrl;
}

export type ListArticlesParams = {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
};

export async function listPublishedArticles(
  params: ListArticlesParams = {},
): Promise<{ rows: Article[]; count: number }> {
  const { search, category, limit = 8, offset = 0 } = params;
  let query = db
    .from("articles")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search && search.trim().length > 0) {
    const q = search.trim();
    query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);
  }
  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data as Article[]) ?? [], count: count ?? 0 };
}

export async function getArticleByUrlId(urlId: string): Promise<Article | null> {
  const { data, error } = await db
    .from("articles")
    .select("*")
    .eq("url_id", urlId)
    .maybeSingle();
  if (error) throw error;
  return (data as Article) ?? null;
}

export async function listRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const { data, error } = await db
    .from("articles")
    .select("*")
    .eq("status", "published")
    .eq("category", article.category)
    .neq("id", article.id)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Article[]) ?? [];
}

export async function listMyArticles(userId: string): Promise<Article[]> {
  const { data, error } = await db
    .from("articles")
    .select("*")
    .eq("author_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Article[]) ?? [];
}
