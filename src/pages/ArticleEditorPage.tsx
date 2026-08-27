import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArticleEditor } from "@/components/articles/ArticleEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin, isHost } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ARTICLE_CATEGORIES,
  Article,
  ArticleCategory,
  coverImageUrl,
  getArticleByUrlId,
} from "@/lib/articles";

// The generated Database type does not yet include the `articles` table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function ArticleEditorPage() {
  const { articleId } = useParams<{ articleId?: string }>();
  const isEdit = Boolean(articleId);
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();
  const canWrite = isHost(roles) || isAdmin(roles);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existing, setExisting] = useState<Article | null>(null);

  const [title, setTitle]         = useState("");
  const [category, setCategory]   = useState<ArticleCategory>("travel_tips");
  const [excerpt, setExcerpt]     = useState("");
  const [body, setBody]           = useState("");
  const [readMinutes, setReadMinutes] = useState(5);
  const [coverPath, setCoverPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !articleId) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await getArticleByUrlId(articleId);
        if (cancelled) return;
        if (!a) {
          toast({ title: "Article not found", variant: "destructive" });
          navigate("/articles");
          return;
        }
        setExisting(a);
        setTitle(a.title);
        setCategory(a.category);
        setExcerpt(a.excerpt);
        setBody(a.body_html);
        setReadMinutes(a.read_minutes);
        setCoverPath(a.cover_path);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, isEdit, navigate]);

  async function handleCoverUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("article-covers")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setCoverPath(path);
      toast({ title: "Cover uploaded" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  function isValid(): boolean {
    // TipTap emits `<p></p>` for empty content — strip tags before checking.
    const bodyText = body.replace(/<[^>]+>/g, "").trim();
    return title.trim().length > 2 && excerpt.trim().length > 0 && bodyText.length > 0;
  }

  async function save(publish: boolean) {
    if (!user || !isValid()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        title: title.trim(),
        excerpt: excerpt.trim(),
        body_html: body,
        cover_path: coverPath,
        category,
        read_minutes: readMinutes,
        status: publish ? "published" : "draft",
        published_at: publish
          ? existing?.published_at ?? now
          : existing?.status === "published"
            ? existing.published_at
            : null,
      };

      if (isEdit && existing) {
        const { data, error } = await db
          .from("articles")
          .update(payload)
          .eq("id", existing.id)
          .select("url_id")
          .single();
        if (error) throw error;
        toast({ title: publish ? "Article published" : "Draft saved" });
        navigate(`/articles/${data.url_id}`);
      } else {
        const { data, error } = await db
          .from("articles")
          .insert({ ...payload, author_id: user.id })
          .select("url_id")
          .single();
        if (error) throw error;
        toast({ title: publish ? "Article published" : "Draft saved" });
        navigate(`/articles/${data.url_id}`);
      }
    } catch (err) {
      toast({
        title: "Could not save article",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setSaving(true);
    try {
      const { error } = await db.from("articles").delete().eq("id", existing.id);
      if (error) throw error;
      toast({ title: "Article deleted" });
      navigate("/articles");
    } catch (err) {
      toast({
        title: "Delete failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container max-w-3xl py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-2xl py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Log in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to write an article.</p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/auth?mode=signin&next=/articles/new">Log in</Link>
        </Button>
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="container max-w-2xl py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Only hosts and admins can write</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Once you're approved as a host you can share travel guides and city stories here.
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/host/apply">Apply as a host</Link>
        </Button>
      </div>
    );
  }

  const cover = coverImageUrl(coverPath);

  return (
    <div className="landing-warm bg-background text-foreground">
      <Seo
        title={isEdit ? `Edit article · CheapStays` : `New article · CheapStays`}
        description="Write a new article for the CheapStays guides."
        path={isEdit ? `/articles/${articleId}/edit` : "/articles/new"}
      />

      <div className="container max-w-3xl py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {isEdit ? "Edit article" : "Write an article"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the toolbar to format headings, bold, lists, quotes, and links.
          </p>
        </div>

        <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="article-title">Title</Label>
            <Input
              id="article-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Where to Stay in Makati on a Budget"
              maxLength={140}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ArticleCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-read">Read time (minutes)</Label>
              <Input
                id="article-read"
                type="number"
                min={1}
                max={60}
                value={readMinutes}
                onChange={(e) => setReadMinutes(Math.min(60, Math.max(1, Number(e.target.value) || 5)))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cover image</Label>
            {cover && (
              <div className="mb-2 overflow-hidden rounded-xl border border-border/60">
                <img src={cover} alt="" className="w-full h-auto object-cover aspect-[16/9]" />
              </div>
            )}
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverUpload(f);
                }}
              />
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    {cover ? "Replace cover" : "Upload a cover"}
                  </p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · max 5 MB</p>
                </>
              )}
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="article-excerpt">Excerpt</Label>
            <Textarea
              id="article-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="A one to two sentence summary shown on the article list."
            />
            <p className="text-xs text-muted-foreground">{excerpt.length}/280</p>
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <ArticleEditor
              value={body}
              onChange={setBody}
              placeholder="Start writing your guide..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={!isValid() || saving}
                onClick={() => save(false)}
              >
                Save draft
              </Button>
              <Button
                className="rounded-xl"
                disabled={!isValid() || saving}
                onClick={() => save(true)}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : null}
                {existing?.status === "published" ? "Update" : "Publish"}
              </Button>
            </div>
            {isEdit && existing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive rounded-xl"
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" aria-hidden />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this article?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone. The article and its cover image will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
