import { supabase } from "@/integrations/supabase/client";

export type FallbackListing = {
  id: string;
  slug: string;
  title: string;
  city: string;
  province: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_php: number;
  min_nights: number;
  amenities: string[];
  images: string[];
  is_owner_direct: boolean;
  avg_rating?: number;
  review_count?: number;
  why_its_a_deal: string;
  score: number;
};

export async function localSearchFallback(query: string): Promise<{ summary: string; results: FallbackListing[] }> {
  try {
    const { data, error } = await supabase
      .from("listings")
      .select("id, slug, title, city, province, type, bedrooms, bathrooms, max_guests, nightly_php, min_nights, amenities, images, is_owner_direct, avg_rating, review_count")
      .eq("status", "active");

    if (error || !data) throw error || new Error("No listings data returned");

    const queryLower = query.toLowerCase();

    // Parse potential budget constraints from the query, e.g., "under 3k", "under 3000", "below ₱2500"
    let budgetLimit: number | null = null;
    const budgetMatch = /(?:under|below|less than|max|budget of)?\s*(?:₱|p)?\s*(\d+)\s*(k|thousand)?/i.exec(queryLower);
    if (budgetMatch) {
      let num = parseInt(budgetMatch[1], 10);
      const isK = budgetMatch[2];
      if (isK && isK.toLowerCase() === 'k') {
        num = num * 1000;
      }
      budgetLimit = num;
    }

    const scoredListings = data.map((l) => {
      let score = 0;
      const titleMatch = l.title.toLowerCase().includes(queryLower);
      const cityMatch = l.city.toLowerCase().includes(queryLower);
      const provinceMatch = l.province.toLowerCase().includes(queryLower);
      const typeMatch = l.type.toLowerCase().includes(queryLower);
      const descMatch = (l.title + " " + l.city).toLowerCase().includes(queryLower);

      if (titleMatch) score += 40;
      if (cityMatch) score += 35;
      if (provinceMatch) score += 25;
      if (typeMatch) score += 15;
      if (descMatch) score += 10;

      // QC -> Quezon City abbreviation expansion
      if (queryLower.includes("qc") && l.city.toLowerCase().includes("quezon city")) {
        score += 30;
      }
      // BGC -> Bonifacio Global City
      if (queryLower.includes("bgc") && l.city.toLowerCase().includes("taguig")) {
        score += 30;
      }

      // Budget scoring bonus
      if (budgetLimit && l.nightly_php <= budgetLimit) {
        score += 30;
        const savingsRatio = (budgetLimit - l.nightly_php) / budgetLimit;
        score += Math.round(savingsRatio * 15);
      } else if (budgetLimit && l.nightly_php > budgetLimit) {
        score -= 50;
      }

      // Parse JSON images
      let parsedImages: string[] = [];
      try {
        if (typeof l.images === "string") {
          parsedImages = JSON.parse(l.images);
        } else if (Array.isArray(l.images)) {
          parsedImages = l.images as string[];
        }
      } catch { /* ignore */ }

      return {
        id: l.id,
        slug: l.slug ?? "",
        title: l.title,
        city: l.city,
        province: l.province,
        type: l.type,
        bedrooms: l.bedrooms ?? 0,
        bathrooms: l.bathrooms ?? 0,
        max_guests: l.max_guests ?? 0,
        nightly_php: l.nightly_php,
        min_nights: l.min_nights ?? 1,
        amenities: l.amenities ?? [],
        images: parsedImages,
        is_owner_direct: l.is_owner_direct,
        avg_rating: l.avg_rating ?? 0,
        review_count: l.review_count ?? 0,
        why_its_a_deal: l.is_owner_direct 
          ? "Owner-direct with no platform markups, saving you up to 20%!"
          : "Highly rated local staycation featuring premium guest comfort.",
        score: Math.max(0, Math.min(100, score))
      };
    });

    let filteredListings = scoredListings
      .filter((l) => l.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    if (filteredListings.length === 0) {
      filteredListings = scoredListings
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }

    const matchedCount = filteredListings.length;
    const summary = matchedCount > 0
      ? `I found ${matchedCount} fantastic stays matching "${query}" with owner-direct pricing.`
      : `I couldn't find exact matches for "${query}", but here are some of our best-value stays:`;

    return {
      summary,
      results: filteredListings as FallbackListing[]
    };
  } catch (err) {
    console.error("Local search fallback failed:", err);
    return {
      summary: "I'm having some trouble searching active listings right now, but you can browse all properties on our search catalog.",
      results: []
    };
  }
}
