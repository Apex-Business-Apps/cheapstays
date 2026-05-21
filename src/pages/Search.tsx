import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { aiSearchSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Seo } from "@/components/Seo";

type Result = { title: string; city: string; nightly_usd: number; why_its_a_deal: string; score: number };

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const parsed = aiSearchSchema.safeParse({ query });
    if (!parsed.success) {
      toast({ title: "Refine your search", description: "Try at least a few words." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", { body: parsed.data });
      if (error) throw error;
      setResults(data?.results ?? []);
      setSummary(data?.summary ?? "");
    } catch (err) {
      toast({ title: "Search failed", description: (err as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div>
      <Seo title="CheapStays Search" description="Search owner-direct Philippine rentals with AI-powered filters." path="/search" />
    <div className="container py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">AI deal search</h1>
        <p className="mt-2 text-muted-foreground">
          Describe your trip. Our AI ranks listings by real value, not booking-site noise.
        </p>
      </div>
      <form onSubmit={run} className="mt-6 flex gap-2 max-w-2xl">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="2 nights in Lisbon under $90, walkable, fast wifi…" />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" /> Search</>}
        </Button>
      </form>
      {summary && <p className="mt-6 text-sm text-muted-foreground max-w-2xl border-l-2 border-accent pl-3">{summary}</p>}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {results.map((r, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{r.title}</h3>
                <p className="text-sm text-muted-foreground">{r.city}</p>
              </div>
              <Badge variant="secondary">${r.nightly_usd}/night</Badge>
            </div>
            <p className="mt-3 text-sm">{r.why_its_a_deal}</p>
            <div className="mt-3 text-xs text-muted-foreground">Deal score · {r.score}/100</div>
          </Card>
        ))}
      </div>
    </div>
    </div>
  );
}