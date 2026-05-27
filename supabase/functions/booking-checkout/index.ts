/**
 * Edge function: booking-checkout
 *
 * Creates a PayMongo hosted checkout session for an existing booking.
 * Returns { checkout_url } so the frontend can redirect immediately.
 *
 * Required Supabase secrets:
 *   PAYMONGO_SECRET_KEY  – PayMongo secret key
 *   SITE_URL             – e.g. https://cheapstays.me (for success/cancel redirects)
 */
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  payment_method: z.enum(["gcash", "maya", "card"]).default("gcash"),
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
    const rl = await rateLimit(`booking-checkout:${ip}`, 5, 60_000);
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

    const { booking_id, payment_method } = parsed.data;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify booking belongs to this user and is awaiting payment
    const { data: booking } = await adminClient
      .from("bookings")
      .select("id, guest_id, listing_id, check_in, check_out, total_php, status, payment_status")
      .eq("id", booking_id)
      .eq("guest_id", user.id)
      .single();

    if (!booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pending", "confirmed"].includes(booking.status) || booking.payment_status !== "unpaid") {
      return new Response(JSON.stringify({ error: "Booking is not awaiting payment" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: listing } = await adminClient
      .from("listings")
      .select("title")
      .eq("id", booking.listing_id)
      .single();

    const appEnv = Deno.env.get("APP_ENV") || Deno.env.get("VITE_APP_ENV") || "production";
    const paymentsEnabled = Deno.env.get("PAYMENTS_ENABLED") !== "false";
    const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");

    if (!paymentsEnabled) {
      return new Response(JSON.stringify({ error: "Payments are currently disabled" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paymongoKey) {
      if (appEnv === "production") {
        return new Response(JSON.stringify({ error: "Payment configuration missing in production" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Graceful no-op: payment provider not configured, booking stands without payment
      return new Response(
        JSON.stringify({ checkout_url: null, reason: "payment_not_configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://cheapstays.me";
    const pmMethodMap: Record<string, string[]> = {
      gcash: ["gcash"],
      maya: ["paymaya"],
      card: ["card"],
    };

    const nightlyTotal = Number(booking.total_php);
    const nights = Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000,
    );

    const sessionPayload = {
      data: {
        attributes: {
          line_items: [
            {
              currency: "PHP",
              amount: Math.round(nightlyTotal * 100), // PayMongo uses centavos
              name: `CheapStays: ${listing?.title ?? "Property Booking"}`,
              description: `${nights} night${nights === 1 ? "" : "s"} · ${booking.check_in} to ${booking.check_out}`,
              quantity: 1,
            },
          ],
          payment_method_types: pmMethodMap[payment_method],
          success_url: `${siteUrl}/my-bookings?payment=success&booking=${booking_id}`,
          cancel_url: `${siteUrl}/my-bookings?payment=cancelled&booking=${booking_id}`,
          metadata: { booking_id, user_id: user.id },
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

    const checkoutUrl = json.data!.attributes.checkout_url;

    // Update booking payment state
    await adminClient.from("bookings").update({
      payment_provider: "paymongo",
      payment_method,
      payment_state: "intent_created",
      payment_status: "pending",
    }).eq("id", booking_id);

    return new Response(
      JSON.stringify({ checkout_url: checkoutUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
