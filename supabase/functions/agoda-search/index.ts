import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

// ---------------------------------------------------------------------------
// Agoda Affiliate Partner API – property search proxy
//
// Required Supabase secrets (set via: supabase secrets set KEY=value):
//   AGODA_SITE_ID   – your numeric site ID from affiliates.agoda.com
//   AGODA_API_KEY   – your API key from the affiliate portal
//
// Agoda affiliate API docs: https://affiliates.agoda.com/tools/api
// ---------------------------------------------------------------------------

const AGODA_BASE = "https://affiliateapi7643.agoda.com/affiliateservice/belt/v1";

// Major Philippine cities → Agoda city IDs
// Full list: https://affiliates.agoda.com/tools/api (city lookup endpoint)
const PH_CITY_IDS: Record<string, number> = {
  "manila":          868,
  "makati":          868,
  "bgc":             868,
  "taguig":          868,
  "cebu":            4973,
  "cebu city":       4973,
  "davao":           6243,
  "boracay":         3958,
  "palawan":         8065,
  "el nido":         27243,
  "coron":           13289,
  "puerto princesa": 8065,
  "siargao":         40060,
  "bohol":           7584,
  "tagaytay":        9022,
  "batangas":        42395,
  "baguio":          5262,
  "la union":        30124,
  "vigan":           14455,
  "iloilo":          8437,
  "dumaguete":       7924,
  "camiguin":        23684,
  "batanes":         68888,
};

function resolveCityId(destination: string): number | null {
  const lower = destination.toLowerCase().trim();
  for (const [key, id] of Object.entries(PH_CITY_IDS)) {
    if (lower.includes(key)) return id;
  }
  return null;
}

type AgodaHotel = {
  hotelId: number;
  hotelName: string;
  address: { city: string };
  starRating: number;
  reviewScore: number;
  reviewCount: number;
  imageUrl: string;
  ratesSummary: { minPrice: number; currencyCode: string };
};

function toPhp(price: number, currency: string): number {
  // Agoda returns local currency; most PH queries return PHP already.
  // For USD fallback, use an approximate rate (update periodically).
  if (currency === "PHP") return Math.round(price);
  if (currency === "USD") return Math.round(price * 57);
  return Math.round(price);
}

function affiliateBookingUrl(
  siteId: string,
  hotelId: number,
  checkIn: string,
  checkOut: string,
  adults: number,
): string {
  const params = new URLSearchParams({
    site_id: siteId,
    hotel_id: String(hotelId),
    checkIn,
    checkOut,
    adults: String(adults),
    rooms: "1",
    currency: "PHP",
    lang: "en-us",
    tag: "cheapstays",
  });
  return `https://www.agoda.com/partners/partnersearch.aspx?${params}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip, 20, 60)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const siteId  = Deno.env.get("AGODA_SITE_ID");
  const apiKey  = Deno.env.get("AGODA_API_KEY");

  if (!siteId || !apiKey) {
    return new Response(
      JSON.stringify({ results: [], message: "Agoda credentials not configured." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const destination: string = body.destination ?? body.query ?? "";
  const checkIn:  string = body.checkIn  ?? body.check_in  ?? "";
  const checkOut: string = body.checkOut ?? body.check_out ?? "";
  const adults:   number = Number(body.adults ?? 2);

  const cityId = resolveCityId(destination);
  if (!cityId) {
    return new Response(
      JSON.stringify({ results: [], message: `No Agoda city mapping for: ${destination}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const payload = {
    criteria: {
      cityId,
      checkIn:  checkIn  || new Date().toISOString().split("T")[0],
      checkOut: checkOut || new Date(Date.now() + 86400000).toISOString().split("T")[0],
      rooms: 1,
      adults,
      children: 0,
    },
    features: { currencyCode: "PHP", language: "en-us" },
  };

  const agodaRes = await fetch(`${AGODA_BASE}/property/availabilitysummary`, {
    method: "POST",
    headers: {
      "Authorization": `${siteId}:${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!agodaRes.ok) {
    const errText = await agodaRes.text();
    console.error("Agoda API error:", agodaRes.status, errText);
    return new Response(
      JSON.stringify({ results: [], message: "Agoda API unavailable." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const agodaData = await agodaRes.json();
  const hotels: AgodaHotel[] = agodaData?.result?.propertySearchResults ?? [];

  const results = hotels.slice(0, 9).map((h) => ({
    id:           `agoda_${h.hotelId}`,
    title:        h.hotelName,
    city:         h.address?.city ?? destination,
    star_rating:  h.starRating ?? 0,
    review_score: Number((h.reviewScore ?? 0).toFixed(1)),
    review_count: h.reviewCount ?? 0,
    nightly_php:  toPhp(h.ratesSummary?.minPrice ?? 0, h.ratesSummary?.currencyCode ?? "PHP"),
    image_url:    h.imageUrl ?? "",
    booking_url:  affiliateBookingUrl(siteId, h.hotelId, checkIn, checkOut, adults),
    is_partner:   true as const,
    source:       "agoda" as const,
  }));

  return new Response(
    JSON.stringify({ results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
