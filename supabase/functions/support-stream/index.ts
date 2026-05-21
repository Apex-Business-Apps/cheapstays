import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const BodySchema = z.object({
  ticket_id: z.string().uuid().optional(),
  prompt: z.string().min(1).max(2000),
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

  const rl = rateLimit(`support-stream:${user.id}`, 20, 60_000);
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
        { role: "system", content: "You are cheapstays.me support AI. Direct, warm, useful. Plain text." },
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
