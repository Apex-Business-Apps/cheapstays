import { z } from "npm:zod@3.23.8";
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

    const system = `You are the cheapstays.me deal-hunting AI. You return ONLY valid JSON matching this exact shape:
{"summary": string, "results": [{"title": string, "city": string, "nightly_usd": number, "why_its_a_deal": string, "score": number}]}
Return 4-6 realistic, plausible short-term rental deals matching the user's request. Score is 0-100 based on real value (price vs typical nightly for that city/quality). Tone: confident, direct, friendly. No corporate filler. No markdown.`;

    const userMsg = `Query: ${query}\nFilters: ${JSON.stringify(filters ?? {})}`;

    const raw = await groqChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      json: true,
      temperature: 0.6,
    });

    let json: unknown;
    try { json = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
