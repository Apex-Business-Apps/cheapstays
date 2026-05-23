/**
 * Edge function: send-email-notification
 *
 * Sends transactional email via Resend.
 * Required secret: RESEND_API_KEY (set via `supabase secrets set`)
 *
 * If RESEND_API_KEY is absent the function returns { sent: false, reason: "no_key" }
 * instead of erroring — callers can treat this as a graceful no-op.
 *
 * Caller must be service_role (internal) or an authenticated admin.
 */

import { corsHeaders } from "../_shared/cors.ts";

const FROM = "CheapStays <cheapstays.me@gmail.com>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ sent: false, reason: "no_key" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { to, subject, text, html } = await req.json() as {
    to: string;
    subject: string;
    text: string;
    html?: string;
  };

  if (!to || !subject || !text) {
    return new Response(JSON.stringify({ error: "to, subject, and text are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body: Record<string, unknown> = { from: FROM, to: [to], subject, text };
  if (html) body.html = html;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ sent: false, reason: detail }), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
