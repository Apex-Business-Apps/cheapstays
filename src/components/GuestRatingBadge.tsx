import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  size?: "sm" | "md";
  className?: string;
};

type RatingData = { avg: number; count: number } | null;

const cache = new Map<string, RatingData>();

export function GuestRatingBadge({ userId, size = "sm", className }: Props) {
  const [data, setData] = useState<RatingData | undefined>(
    cache.has(userId) ? cache.get(userId) : undefined
  );

  useEffect(() => {
    if (cache.has(userId)) { setData(cache.get(userId)); return; }
    supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", userId)
      .eq("reviewer_role", "host")
      .eq("is_public", true)
      .then(({ data: rows }) => {
        if (!rows || rows.length === 0) {
          cache.set(userId, null);
          setData(null);
          return;
        }
        const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
        const result = { avg: Math.round(avg * 10) / 10, count: rows.length };
        cache.set(userId, result);
        setData(result);
      });
  }, [userId]);

  if (!data) return null;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border border-yellow-300/60 bg-yellow-50 dark:bg-yellow-950/30 px-2 py-0.5 font-medium text-yellow-700 dark:text-yellow-400",
      size === "sm" ? "text-[10px]" : "text-xs",
      className
    )}>
      <Star className={cn("fill-yellow-400 text-yellow-400", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
      {data.avg.toFixed(1)} guest · {data.count} {data.count === 1 ? "review" : "reviews"}
    </span>
  );
}
