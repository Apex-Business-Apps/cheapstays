import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { groqChat } from "../_shared/groq.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const SUPPORT_CATEGORIES = [
  "booking",
  "payment_refund",
  "host_verification",
  "property_condition",
  "incidentals_damage",
  "safety_privacy_surveillance",
  "account_access",
  "technical_bug",
] as const;

const BodySchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(5).max(4000),
  category: z.enum(SUPPORT_CATEGORIES).default("booking"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

const EXTREME_ESCALATION_KEYWORDS = [
  "fraud", "chargeback", "scam", "stolen", "threat", "assault", "harassment", "fire", "police", "lawsuit",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = await rateLimit(`support-ticket:${user.id}`, 10, 60_000);
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

    const { subject, message, category, priority } = parsed.data;
    const lc = (subject + " " + message).toLowerCase();
    // Escalate only subjective/extreme outliers to avoid noisy manual queues.
    const escalated = priority === "urgent" || EXTREME_ESCALATION_KEYWORDS.some((k) => lc.includes(k));

    // service-role client for writes that bypass RLS in a controlled way
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: tErr } = await admin
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject, category, priority,
        status: escalated ? "escalated" : "open",
        escalated,
      })
      .select()
      .single();
    if (tErr) throw tErr;

    // user's first message
    await admin.from("support_messages").insert({
      ticket_id: ticket.id, sender: "user", author_user_id: user.id, content: message,
    });

    let ai_response: string | null = null;
    if (!escalated) {
      try {
        ai_response = await groqChat({
          messages: [
            { role: "system", content: "You are cheapstays.me's friendly support AI. Give a concrete, useful first reply in 2-4 short paragraphs. Tone: direct, warm, no corporate filler. If the request truly needs a human, say so plainly." },
            { role: "user", content: `Subject: ${subject}\n\n${message}` },
          ],
          temperature: 0.5,
        });
        await admin.from("support_messages").insert({
          ticket_id: ticket.id, sender: "ai", content: ai_response,
        });
        await admin.from("support_tickets").update({ ai_response, status: "pending" }).eq("id", ticket.id);
      } catch (e) {
        ai_response = null;
        await admin.from("support_tickets").update({ escalated: true, status: "escalated" }).eq("id", ticket.id);
      }
    }

    return new Response(
      JSON.stringify({
        ticket_id: ticket.id,
        ticket_num: ticket.ticket_num,
        ai_response,
        escalated: escalated || ai_response === null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
