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
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, filters } = parsed.data;

    // Connect to Supabase with service role to read all active listings
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build query against real listings table
    let dbQuery = supabase
      .from("listings")
      .select(
        "id, title, city, province, bedrooms, max_guests, nightly_php, amenities, avg_rating, review_count, is_owner_direct, instant_book, type",
      )
      .eq("status", "active");

    if (filters?.maxNightly) dbQuery = dbQuery.lte("nightly_php", filters.maxNightly);
    if (filters?.minNights) dbQuery = dbQuery.gte("min_nights", filters.minNights);
    if (filters?.city) dbQuery = dbQuery.ilike("city", `%${filters.city}%`);

    dbQuery = dbQuery.limit(20);

    const { data: listings, error: dbError } = await dbQuery;

    if (dbError) {
      return new Response(JSON.stringify({ error: "Failed to fetch listings", detail: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "No listings found matching your criteria. Try adjusting your filters.",
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const system = `You are the CheapStays deal-hunting AI. Given real property listings and a user query, score each listing 0-100 for value and fit. Return ONLY valid JSON:
{"summary": string, "results": [{"id": string, "title": string, "city": string, "nightly_php": number, "why_its_a_deal": string, "score": number, "bedrooms": number, "max_guests": number, "amenities": string[], "avg_rating": number|null, "is_owner_direct": boolean}]}
Return up to 6 best matches. Tone: direct and friendly. No markdown.`;

    const userMsg = `Query: ${query}\nFilters: ${JSON.stringify(filters ?? {})}\nListings:\n${JSON.stringify(listings)}`;

    const raw = await groqChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      json: true,
      temperature: 0.4,
    });

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
