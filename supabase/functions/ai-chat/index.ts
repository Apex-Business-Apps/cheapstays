import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { AI_PROMPT_VERSION_REGISTRY, buildGuardrailSystemPrompt, detectGuardrailViolation, fallbackGuardrailResponse } from "../_shared/ai-governance.ts";
import { logAiDecision } from "../_shared/ai-audit.ts";
import { isApprovedRegistryCommand } from "../_shared/command-authority.ts";

const SUPPORTED_LANGS = ["en", "fil", "zh", "ms", "id", "ko", "vi", "ja", "th"] as const;
type SupportedLang = typeof SUPPORTED_LANGS[number];

const LANG_NAMES: Record<SupportedLang, string> = {
  en:  "English",
  fil: "Filipino (Tagalog)",
  zh:  "Chinese (Simplified)",
  ms:  "Malay",
  id:  "Indonesian",
  ko:  "Korean",
  vi:  "Vietnamese",
  ja:  "Japanese",
  th:  "Thai",
};

const MsgSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(4000),
});
const BodySchema = z.object({
  messages: z.array(MsgSchema).min(1).max(40),
  lang: z.enum(SUPPORTED_LANGS).optional().default("en"),
  command_id: z.string().min(3).max(120).optional(),
  top_level_command: z.boolean().optional(),
});

const LISTING_KEYWORDS = /\b(find|search|look|stay|listing|place|room|villa|condo|house|cabin|rent|book|available|cheap|price|cost|budget|night|nights|where|accommodation|property|properties|host|airbnb)\b/i;
const RATING_KEYWORDS = /\b(rat(e|ing|ings)|review|reviews|trust|reliable|safe|guest rating|host rating|score|stars?)\b/i;
const BOOKING_KEYWORDS = /\b(book(ing)?|reserv(e|ation)|calendar|availability|check.?in|check.?out|confirm|cancel|pending|schedule)\b/i;
const FILTER_KEYWORDS = /\b(filter|sort|cheap(est)?|expensive|highest rated|best rated|instant book|owner.?direct|bedroom|bath|amenity|amenities|pool|wifi|aircon|parking|pet)\b/i;

async function fetchListingsContext(): Promise<string> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("listings")
      .select("id,title,city,province,type,bedrooms,bathrooms,max_guests,nightly_php,min_nights,amenities,is_owner_direct,instant_book")
      .eq("status", "active")
      .limit(60);

    if (!data || data.length === 0) return "";

    const lines = data.map((l) =>
      `• ID:${l.id} | "${l.title}" in ${l.city}, ${l.province} — ₱${l.nightly_php}/night | ` +
      `${l.bedrooms}BR ${l.bathrooms}BA | max ${l.max_guests} guests | min ${l.min_nights} nights | ` +
      `${l.type} | amenities: ${(l.amenities ?? []).slice(0, 6).join(", ")} | ` +
      `owner-direct: ${l.is_owner_direct} | instant-book: ${l.instant_book}`
    );

    return `\n\nLIVE LISTINGS (${data.length} active properties from database):\n${lines.join("\n")}\n\nWhen recommending listings, cite the title, city, and price in ₱. Direct users to /search to browse all listings.`;
  } catch {
    return "";
  }
}

const BASE_SYSTEM = `You are Pip, the cheapstays.me concierge — a fast, witty AI travel agent specialising in owner-direct short-term rentals in the Philippines.
You help users find deals, plan trips, compare cities, decide on stays, manage bookings, and understand the ratings system.
Be conversational, concise (2-4 sentences unless asked for detail), confident, and warm. No corporate fluff. No markdown unless asked.

PLATFORM CAPABILITIES:
- SEARCH & FILTERS: /search has a Filters button (Sheet panel) for price range, bedrooms, max guests, property type, amenities, instant book, and owner-direct. Sort options: deal score (best value), price low-to-high, price high-to-low, highest rated.
- BOOKING: Each listing page has a real-time availability calendar and booking panel on the right. Users pick dates, see a price breakdown (nightly rate × nights + 5% service fee), then request or instant-book.
- TWO-WAY RATINGS: Guests rate hosts/listings (1–5 stars) after a stay. Hosts rate guests too. These ratings appear as informational guides — a yellow star badge called "Guest Rating" helps both sides make informed decisions. Not a hard blocker, just trust signals.
- HOST DASHBOARD: /host has three tabs — New listing (create a property), My listings (manage existing), Bookings (see all bookings, confirm or decline pending ones, rate guests after stays).
- OWNER DIRECT: Many listings are owner-direct — no middleman, direct contact with host, potentially better prices.

NAVIGATION GUIDE:
- Browse properties: /search
- List a property: /host
- View/manage bookings (as host): /host → Bookings tab
- Sign in / create account: /auth
- Get help: /support

IMPORTANT: When asked about listings or places to stay, use the LIVE LISTINGS data injected below — answer with real property names, prices, and locations. Never say "go search yourself" if you have the data.
When users ask about filtering, sorting, or finding cheapest/best-rated options, explain the filter and sort controls at /search.
When users ask about their bookings or managing a property, direct them to /host.
When users ask about ratings or trust, explain the two-way rating system as a helpful guide, not a barrier.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`ai-chat:${ip}`, 40, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Slow down a bit." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsed.data.top_level_command) {
      const approved = parsed.data.command_id ? await isApprovedRegistryCommand(parsed.data.command_id) : false;
      if (!approved) {
        await logAiDecision({ surface: "summary", decision: "blocked", prompt_version: AI_PROMPT_VERSION_REGISTRY.summary, reason: "registry_gate_blocked", payload: { command_id: parsed.data.command_id ?? null } });
        return new Response("Top-level commands must come from approved GitHub registry flow.", { status: 403, headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });
      }
    }

    const latestUserText = parsed.data.messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
    const violations = detectGuardrailViolation(latestUserText);
    if (violations.length) {
      await logAiDecision({ surface: "summary", decision: "blocked", prompt_version: AI_PROMPT_VERSION_REGISTRY.summary, reason: "guardrail_violation", payload: { violations } });
      return new Response(fallbackGuardrailResponse(), { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) throw new Error("GROQ_API_KEY missing");

    const lang = parsed.data.lang;
    const allText = parsed.data.messages.map((m) => m.content).join(" ");
    const needsListings = LISTING_KEYWORDS.test(allText) || RATING_KEYWORDS.test(allText) ||
      BOOKING_KEYWORDS.test(allText) || FILTER_KEYWORDS.test(allText);
    const listingsContext = needsListings ? await fetchListingsContext() : "";

    // Inject language instruction so Groq responds in the user's UI language.
    // Placed after BASE_SYSTEM so it takes precedence over the English-language examples.
    const langInstruction = lang !== "en"
      ? `\n\nLANGUAGE INSTRUCTION: The user's interface is set to ${LANG_NAMES[lang]}. ` +
        `You MUST respond in ${LANG_NAMES[lang]} unless the user explicitly writes to you in a different language. ` +
        `Keep all property names, prices (₱), and place names in their original form.`
      : "";

    const systemContent = `${buildGuardrailSystemPrompt("summary")}\n\n${BASE_SYSTEM}${langInstruction}${listingsContext}`;

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        stream: true,
        messages: [{ role: "system", content: systemContent }, ...parsed.data.messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: `Upstream ${upstream.status}: ${text}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (payload === "[DONE]") { controller.close(); return; }
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content ?? "";
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch { /* ignore */ }
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
