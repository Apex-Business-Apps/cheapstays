import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { AI_PROMPT_VERSION_REGISTRY, buildGuardrailSystemPrompt, detectGuardrailViolation, fallbackGuardrailResponse } from "../_shared/ai-governance.ts";
import { logAiDecision } from "../_shared/ai-audit.ts";
import { isApprovedRegistryCommand } from "../_shared/command-authority.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const BodySchema = z.object({
  ticket_id: z.string().uuid().optional(),
  prompt: z.string().min(1).max(2000),
  command_id: z.string().min(3).max(120).optional(),
  top_level_command: z.boolean().optional(),
});

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { user } = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rl = await rateLimit(`support-stream:${user.id}`, 20, 60_000);
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


  if (parsed.data.top_level_command) {
    const approved = parsed.data.command_id ? await isApprovedRegistryCommand(parsed.data.command_id) : false;
    if (!approved) {
      await logAiDecision({ surface: "support", decision: "blocked", actor_id: user.id, prompt_version: AI_PROMPT_VERSION_REGISTRY.support, reason: "registry_gate_blocked", payload: { command_id: parsed.data.command_id ?? null } });
      return new Response(JSON.stringify({ error: "Top-level commands must come from approved GitHub registry flow." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const violations = detectGuardrailViolation(parsed.data.prompt);
  if (violations.length) {
    await logAiDecision({ surface: "support", decision: "blocked", actor_id: user.id, prompt_version: AI_PROMPT_VERSION_REGISTRY.support, reason: "guardrail_violation", payload: { violations } });
    return new Response(JSON.stringify({ error: fallbackGuardrailResponse() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      stream: true,
      temperature: 0.5,
      messages: [
        { role: "system", content: `${buildGuardrailSystemPrompt("support")}\n\nYou are cheapstays.me support AI. Direct, warm, useful. Plain text.` },
        { role: "user", content: parsed.data.prompt },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: text }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pass-through SSE stream from Groq
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
