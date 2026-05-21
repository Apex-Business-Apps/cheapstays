import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { aiDescribeSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";
import { Seo } from "@/components/Seo";

export default function Host() {
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  async function describe() {
    const parsed = aiDescribeSchema.safeParse({
      title,
      bullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      tone: "confident",
    });
    if (!parsed.success) {
      toast({ title: "Add a title and at least one bullet", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-describe", { body: parsed.data });
      if (error) throw error;
      setOut(data?.description ?? "");
    } catch (err) {
      toast({ title: "AI error", description: (err as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div>
      <Seo title="Host on CheapStays" description="List your property on CheapStays and reach verified travelers directly." path="/host" />
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Host tools</h1>
      <p className="text-muted-foreground mt-2">
        Paste your listing's bones — we write a clean, honest description with zero fluff.
      </p>
      <Card className="p-6 mt-8 space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunny 1BR in Lisbon, walk to metro" />
        </div>
        <div className="space-y-2">
          <Label>Bullet points (one per line)</Label>
          <Textarea rows={6} value={bullets} onChange={(e) => setBullets(e.target.value)}
            placeholder={"45m² · 1 bed\nWalk to Rato metro · 6min\nFast wifi · 200 Mbps\nWasher + dryer"} />
        </div>
        <Button onClick={describe} disabled={loading}>
          <Sparkles className="h-4 w-4 mr-1" /> {loading ? "Writing…" : "Generate description"}
        </Button>
        {out && <div className="mt-4 border-t pt-4 whitespace-pre-wrap text-sm leading-relaxed">{out}</div>}
      </Card>
    </div>
    </div>
  );
}