import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const PAYMONGO_BASE = "https://api.paymongo.com/v1";
const MEMBER_PRICE_PHP = 249;
const MEMBER_PRICE_CENTAVOS = MEMBER_PRICE_PHP * 100;

const BodySchema = z.object({
  payment_method: z.enum(["gcash", "maya", "card"]),
});

function pmHeaders(key: string) {
  return {
    Authorization: `Basic ${btoa(`${key}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await rateLimit(`membership-payment-intent:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payment_method } = parsed.data;
    const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymongoKey) {
      return new Response(JSON.stringify({ error: "Payment provider not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Block if user already has an active subscription.
    const { data: existing } = await adminClient
      .from("membership_subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "You already have an active membership" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://cheapstays.me";

    const pmMethodMap: Record<string, string[]> = {
      gcash: ["gcash"],
      maya: ["paymaya"],
      card: ["card"],
    };

    const sessionPayload = {
      data: {
        attributes: {
          line_items: [
            {
              currency: "PHP",
              amount: MEMBER_PRICE_CENTAVOS,
              name: "CheapStays Member",
              description: "Monthly membership — unlimited AI search, real-time alerts, owner-direct contacts.",
              quantity: 1,
            },
          ],
          payment_method_types: pmMethodMap[payment_method],
          success_url: `${siteUrl}/membership?success=true`,
          cancel_url: `${siteUrl}/membership?cancelled=true`,
          metadata: {
            user_id: user.id,
            plan: "member_monthly",
          },
        },
      },
    };

    const res = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
      method: "POST",
      headers: pmHeaders(paymongoKey),
      body: JSON.stringify(sessionPayload),
    });

    const json = await res.json() as {
      data?: { id: string; attributes: { checkout_url: string } };
      errors?: { detail: string }[];
    };

    if (!res.ok) {
      const detail = json.errors?.[0]?.detail ?? "Payment provider error";
      return new Response(JSON.stringify({ error: detail }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionId = json.data!.id;
    const checkoutUrl = json.data!.attributes.checkout_url;

    // Record the pending subscription so we can confirm it on webhook.
    await adminClient.from("membership_subscriptions").insert({
      user_id: user.id,
      status: "past_due",
      plan: "member_monthly",
      paymongo_session_id: sessionId,
    });

    return new Response(
      JSON.stringify({ checkout_url: checkoutUrl, session_id: sessionId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
