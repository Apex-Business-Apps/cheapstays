import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { groqChat } from "../_shared/groq.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { dispatchNotification } from "../_shared/notify.ts";

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

// Escalate only subjective/extreme outliers — keeps manual queue signal-to-noise high.
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
    const escalated = priority === "urgent" || EXTREME_ESCALATION_KEYWORDS.some((k) => lc.includes(k));

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

        // Notify user: AI has responded to their new ticket
        await dispatchNotification(admin, {
          userId: user.id,
          type: "support_ticket_updated",
          title: `Support reply — Ticket #${ticket.ticket_num}`,
          body: "We've responded to your support ticket. Check in to continue the conversation.",
          data: { ticket_id: ticket.id, ticket_num: ticket.ticket_num },
          url: "/support",
        });
      } catch {
        ai_response = null;
        await admin.from("support_tickets").update({ escalated: true, status: "escalated" }).eq("id", ticket.id);
      }
    } else {
      // Escalated: notify user their ticket is being handled by a human
      await dispatchNotification(admin, {
        userId: user.id,
        type: "support_ticket_updated",
        title: `Ticket #${ticket.ticket_num} escalated`,
        body: "Your ticket has been flagged for human review. Our team will follow up shortly.",
        data: { ticket_id: ticket.id, ticket_num: ticket.ticket_num, escalated: true },
        url: "/support",
      });
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
