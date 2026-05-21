import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { groqChat } from "../_shared/groq.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  query: z.string().min(2).max(500),
  filters: z
    .object({
      maxNightly: z.number().positive().optional(),
      minNights: z.number().int().positive().optional(),
      city: z.string().max(120).optional(),
    })
    .optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = rateLimit(`ai-search:${ip}`, 20, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, filters } = parsed.data;

    // Fetch real listings from the database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let dbQuery = supabase
      .from("listings")
      .select("id,title,slug,city,province,type,bedrooms,bathrooms,max_guests,nightly_php,min_nights,amenities,description,is_owner_direct,instant_book,avg_rating,review_count")
      .eq("status", "active");

    if (filters?.maxNightly) {
      // 1 USD ≈ 56 PHP
      dbQuery = dbQuery.lte("nightly_php", Math.round(filters.maxNightly * 56));
    }
    if (filters?.minNights) {
      dbQuery = dbQuery.lte("min_nights", filters.minNights);
    }

    const { data: listings, error: dbErr } = await dbQuery.limit(100);
    if (dbErr) throw dbErr;

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ summary: "No listings found right now. Check back soon!", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a compact listing catalogue for the AI
    const catalogue = listings
      .map((l, i) =>
        `[${i}] "${l.title}" | ${l.city}, ${l.province} | ₱${l.nightly_php}/night | ` +
        `${l.bedrooms}BR ${l.bathrooms}BA | max ${l.max_guests} guests | min ${l.min_nights} nights | ` +
        `type:${l.type} | amenities:${(l.amenities ?? []).join(",")} | ` +
        `owner_direct:${l.is_owner_direct} | instant_book:${l.instant_book} | ` +
        `desc:${l.description ? l.description.slice(0, 120) : "none"}`
      )
      .join("\n");

    const system = `You are the cheapstays.me deal-hunting AI. You have real listings from the database below.
Match listings to the user query using FUZZY, SEMANTIC matching:
- Be flexible with city names, spelling, abbreviations (e.g. "QC" = "Quezon City", "BGC" = Bonifacio Global City, "NCR" = Metro Manila)
- Match province/region names too ("Metro Manila" matches "NCR", "Palawan" matches "El Nido" or "Coron")
- Ignore case differences entirely
- If the user mentions a budget, filter by nightly_php (₱56 ≈ $1 USD)
- Return ONLY valid JSON: {"summary": string, "results": [{"listing_index": number, "why_its_a_deal": string, "score": number}]}
- Return up to 6 best matches sorted by score desc. Score is 0-100 based on value for money and query fit.
- If truly nothing matches, return empty results array with a helpful summary.
- Do not invent listings not in the catalogue.`;

    const userMsg = `Query: "${query}"\nFilters: ${JSON.stringify(filters ?? {})}\n\nListings catalogue:\n${catalogue}`;

    const raw = await groqChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      json: true,
      temperature: 0.2,
    });

    let aiJson: { summary: string; results: Array<{ listing_index: number; why_its_a_deal: string; score: number }> };
    try {
      aiJson = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = (aiJson.results ?? [])
      .filter((r) => typeof r.listing_index === "number" && r.listing_index >= 0 && r.listing_index < listings.length)
      .map((r) => {
        const l = listings[r.listing_index];
        return {
          id: l.id,
          slug: l.slug,
          title: l.title,
          city: l.city,
          province: l.province,
          type: l.type,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          max_guests: l.max_guests,
          nightly_php: l.nightly_php,
          min_nights: l.min_nights,
          amenities: l.amenities ?? [],
          is_owner_direct: l.is_owner_direct,
          instant_book: l.instant_book,
          avg_rating: l.avg_rating,
          review_count: l.review_count,
          why_its_a_deal: r.why_its_a_deal,
          score: r.score,
        };
      });

    return new Response(JSON.stringify({ summary: aiJson.summary ?? "", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
