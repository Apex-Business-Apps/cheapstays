import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const MsgSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(4000),
});
const BodySchema = z.object({
  messages: z.array(MsgSchema).min(1).max(40),
});

const LISTING_KEYWORDS = /\b(find|search|look|stay|listing|place|room|villa|condo|house|cabin|rent|book|available|cheap|price|cost|budget|night|nights|where|accommodation|property|properties|host|airbnb)\b/i;

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
You help users find deals, plan trips, compare cities, and decide on stays.
Be conversational, concise (2-4 sentences unless asked for detail), confident, and warm. No corporate fluff. No markdown unless asked.
IMPORTANT: When asked about listings or places to stay, use the LIVE LISTINGS data injected below — answer directly with real property names, prices, and locations. Never tell a user to "go search yourself" if you have the data to answer.
For payments or bookings, direct to /support.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = rateLimit(`ai-chat:${ip}`, 40, 60_000);
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

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) throw new Error("GROQ_API_KEY missing");

    const allText = parsed.data.messages.map((m) => m.content).join(" ");
    const needsListings = LISTING_KEYWORDS.test(allText);
    const listingsContext = needsListings ? await fetchListingsContext() : "";
    const systemContent = BASE_SYSTEM + listingsContext;

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
