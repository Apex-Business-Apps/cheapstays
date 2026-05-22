import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { groqChat } from "../_shared/groq.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { AI_PROMPT_VERSION_REGISTRY, buildGuardrailSystemPrompt, detectGuardrailViolation, fallbackGuardrailResponse } from "../_shared/ai-governance.ts";
import { logAiDecision } from "../_shared/ai-audit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const BodySchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, supabase } = await getUserFromRequest(req);
    if (!user || !supabase) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = rateLimit(`support-message:${user.id}`, 30, 60_000);
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

    const { ticket_id, content } = parsed.data;
    const violations = detectGuardrailViolation(content);
    if (violations.length) {
      await logAiDecision({ surface: "support", decision: "blocked", actor_id: user.id, prompt_version: AI_PROMPT_VERSION_REGISTRY.support, reason: "guardrail_violation", payload: { violations, ticket_id } });
      return new Response(JSON.stringify({ ok: true, ai_response: fallbackGuardrailResponse() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RLS will block if not owner; insert via user-scoped client
    const { error: insErr } = await supabase.from("support_messages").insert({
      ticket_id, sender: "user", author_user_id: user.id, content,
    });
    if (insErr) throw insErr;

    // Decide whether AI should respond again (skip if escalated)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: ticket } = await admin.from("support_tickets")
      .select("id, subject, escalated, status").eq("id", ticket_id).single();

    let ai_response: string | null = null;
    if (ticket && !ticket.escalated) {
      const { data: history } = await admin
        .from("support_messages")
        .select("sender, content")
        .eq("ticket_id", ticket_id)
        .order("created_at", { ascending: true })
        .limit(20);

      const msgs = [
        { role: "system" as const, content: `${buildGuardrailSystemPrompt("support")}\n\nYou are cheapstays.me support AI. Be direct, warm, useful. 2-4 short paragraphs. If you can't help confidently, say a human will follow up.` },
        ...(history ?? []).map((m) => ({
          role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
      ];

      try {
        ai_response = await groqChat({ messages: msgs, temperature: 0.5 });
        await admin.from("support_messages").insert({ ticket_id, sender: "ai", content: ai_response });
      } catch (_) {
        ai_response = null;
      }
    }

    await logAiDecision({ surface: "support", decision: "allowed", actor_id: user.id, prompt_version: AI_PROMPT_VERSION_REGISTRY.support, reason: "support_reply_generated", payload: { ticket_id, ai_responded: !!ai_response } });
    return new Response(JSON.stringify({ ok: true, ai_response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
