import { supabase } from "@/integrations/supabase/client";

export type DiscoveryListing = {
  id: string;
  slug: string | null;
  title: string;
  city: string;
  province: string;
  type: string;
  images: string[];
  nightly_php: number;
  avg_rating: number | null;
  review_count: number | null;
  stay_category: string | null;
  stay_availability_type: string | null;
  hourly_php: number | null;
  price_3h: number | null;
  price_6h: number | null;
  price_12h: number | null;
  promo_price: number | null;
};

export type PopularCity = {
  city: string;
  province: string;
  count: number;
  fromPrice: number;
  sample: { title: string; slug: string | null; images: string[]; type: string };
};

const SELECT_COLS =
  "id, slug, title, city, province, type, images, nightly_php, avg_rating, review_count, stay_category, stay_availability_type, hourly_php, price_3h, price_6h, price_12h, promo_price";

// stay_* columns are present in the DB but not always in generated types in older builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function normalizeImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

function mapRow(row: Record<string, unknown>): DiscoveryListing {
  return {
    id: String(row.id),
    slug: (row.slug as string | null) ?? null,
    title: String(row.title ?? ""),
    city: String(row.city ?? ""),
    province: String(row.province ?? ""),
    type: String(row.type ?? ""),
    images: normalizeImages(row.images),
    nightly_php: Number(row.nightly_php ?? 0),
    avg_rating: row.avg_rating != null ? Number(row.avg_rating) : null,
    review_count: row.review_count != null ? Number(row.review_count) : null,
    stay_category: (row.stay_category as string | null) ?? null,
    stay_availability_type: (row.stay_availability_type as string | null) ?? null,
    hourly_php: row.hourly_php != null ? Number(row.hourly_php) : null,
    price_3h: row.price_3h != null ? Number(row.price_3h) : null,
    price_6h: row.price_6h != null ? Number(row.price_6h) : null,
    price_12h: row.price_12h != null ? Number(row.price_12h) : null,
    promo_price: row.promo_price != null ? Number(row.promo_price) : null,
  };
}

/** A listing counts as "promoted" when the host set a real discount price. */
export function isPromoted(l: DiscoveryListing): boolean {
  return l.promo_price != null && l.promo_price > 0 && l.promo_price < l.nightly_php;
}

/** Newest active listings, for the Hero carousel ("fresh" arrivals). */
export async function fetchLatestListings(limit = 10): Promise<DiscoveryListing[]> {
  const { data, error } = await sb
    .from("listings")
    .select(SELECT_COLS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/**
 * Featured Stays = promoted + top-rated active listings.
 *
 * The DB has no `is_featured` flag. The closest signals available to the public
 * (RLS-safe) are:
 *   - promo_price  → a host-set discount ("promoted")
 *   - avg_rating / review_count → quality / popularity ("trending" proxy)
 *
 * True booking-volume "trending" would require an RPC or a denormalized counter,
 * because the bookings table is not publicly readable.
 *
 * We over-fetch active listings ranked by quality, then bubble genuinely
 * promoted listings to the front client-side.
 */
export async function fetchFeaturedStays(limit = 9): Promise<DiscoveryListing[]> {
  const { data, error } = await sb
    .from("listings")
    .select(SELECT_COLS)
    .eq("status", "active")
    .order("avg_rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 24));
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  // Stable sort: promoted listings first, otherwise preserve the quality order.
  return rows
    .map((l, i) => ({ l, i }))
    .sort((a, b) => Number(isPromoted(b.l)) - Number(isPromoted(a.l)) || a.i - b.i)
    .map((x) => x.l)
    .slice(0, limit);
}

/** Latest active listings that offer hourly / quick stays (newest first). */
export async function fetchQuickStays(limit = 9): Promise<DiscoveryListing[]> {
  const { data, error } = await sb
    .from("listings")
    .select(SELECT_COLS)
    .eq("status", "active")
    .in("stay_availability_type", ["hourly", "both"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/** Aggregates active listings by city to surface the most popular destinations. */
export async function fetchPopularCities(limit = 8): Promise<PopularCity[]> {
  const { data, error } = await sb
    .from("listings")
    .select("city, province, nightly_php, title, slug, images, type, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const groups = new Map<string, PopularCity>();
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const city = String(raw.city ?? "").trim();
    if (!city) continue;
    const key = city.toLowerCase();
    const price = Number(raw.nightly_php ?? 0);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (price > 0 && price < existing.fromPrice) existing.fromPrice = price;
    } else {
      groups.set(key, {
        city,
        province: String(raw.province ?? ""),
        count: 1,
        fromPrice: price > 0 ? price : Number.POSITIVE_INFINITY,
        sample: {
          title: String(raw.title ?? ""),
          slug: (raw.slug as string | null) ?? null,
          images: normalizeImages(raw.images),
          type: String(raw.type ?? ""),
        },
      });
    }
  }

  return [...groups.values()]
    .map((c) => ({ ...c, fromPrice: Number.isFinite(c.fromPrice) ? c.fromPrice : 0 }))
    .sort((a, b) => b.count - a.count || a.fromPrice - b.fromPrice)
    .slice(0, limit);
}
