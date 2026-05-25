import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { groqChat } from "../_shared/groq.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { AI_PROMPT_VERSION_REGISTRY, buildGuardrailSystemPrompt, detectGuardrailViolation, fallbackGuardrailResponse } from "../_shared/ai-governance.ts";
import { logAiDecision } from "../_shared/ai-audit.ts";

const BodySchema = z.object({
  title: z.string().min(2).max(200),
  bullets: z.array(z.string().min(1).max(300)).min(1).max(20),
  tone: z.enum(["confident", "playful", "minimal"]).default("confident"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`ai-describe:${ip}`, 15, 60_000);
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

    const { title, bullets, tone } = parsed.data;
    const combined = `${title} ${bullets.join(" ")}`;
    const violations = detectGuardrailViolation(combined);
    if (violations.length) {
      await logAiDecision({ surface: "listing_description", decision: "blocked", prompt_version: AI_PROMPT_VERSION_REGISTRY.listing_description, reason: "guardrail_violation", payload: { violations } });
      return new Response(JSON.stringify({ description: fallbackGuardrailResponse() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const toneGuide = {
      confident: "Direct, factual, zero hype.",
      playful: "Light, warm, a little fun. Still honest.",
      minimal: "Sparse, declarative sentences. Just the facts.",
    }[tone];

    const system = `${buildGuardrailSystemPrompt("listing_description")}\n\nYou write short-term rental descriptions for cheapstays.me. Honest, specific, no fluff. ${toneGuide} 3-4 short paragraphs max. Plain text, no markdown.`;
    const user = `Title: ${title}\nFacts:\n- ${bullets.join("\n- ")}`;

    const description = await groqChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    });

    await logAiDecision({ surface: "listing_description", decision: "allowed", prompt_version: AI_PROMPT_VERSION_REGISTRY.listing_description, reason: "description_generated" });
    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
