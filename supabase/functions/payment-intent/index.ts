import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  payment_method: z.enum(["gcash", "maya", "card"]),
});

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function paymongoHeaders(secretKey: string): Record<string, string> {
  const encoded = btoa(`${secretKey}:`);
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function paymongoPost(
  path: string,
  body: unknown,
  secretKey: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${PAYMONGO_BASE}${path}`, {
    method: "POST",
    headers: paymongoHeaders(secretKey),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = rateLimit(`payment-intent:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: verify caller via their JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Validate request body ---
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking_id, payment_method } = parsed.data;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Fetch booking — must belong to this guest and be payable ---
    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("id, listing_id, guest_id, check_in, check_out, total_php, status, payment_status")
      .eq("id", booking_id)
      .eq("guest_id", user.id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      return new Response(
        JSON.stringify({ error: "Booking is not in a payable state" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (booking.payment_status !== "unpaid") {
      return new Response(
        JSON.stringify({ error: "Booking payment is already in progress or completed" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Fetch listing title for description ---
    const { data: listing } = await adminClient
      .from("listings")
      .select("title")
      .eq("id", booking.listing_id)
      .single();

    const listingTitle = listing?.title ?? "CheapStays property";

    // --- Demo mode: return early if PayMongo key not configured ---
    const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymongoKey) {
      // Mark booking as confirmed in demo mode
      await adminClient
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", booking_id);

      return new Response(
        JSON.stringify({
          demo_mode: true,
          booking_id,
          total_php: booking.total_php,
          message: "Payment gateway not configured. Booking is confirmed for demo.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Step 1: Create PayMongo payment intent ---
    const intentPayload = {
      data: {
        attributes: {
          amount: Math.round(Number(booking.total_php) * 100), // centavos
          payment_method_allowed: ["card", "gcash", "paymaya"],
          payment_method_options: { card: { request_three_d_secure: "any" } },
          currency: "PHP",
          capture_type: "automatic",
          description: `CheapStays booking: ${listingTitle} (${booking.check_in} to ${booking.check_out})`,
          metadata: { booking_id },
        },
      },
    };

    const intentRes = await paymongoPost("/payment_intents", intentPayload, paymongoKey);
    if (!intentRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to create payment intent",
          detail: (intentRes.data as Record<string, unknown>)?.errors ?? intentRes.data,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const intentData = intentRes.data as {
      data: {
        id: string;
        attributes: {
          client_key: string;
          next_action?: { redirect?: { url?: string } };
        };
      };
    };
    const intentId = intentData.data.id;
    const clientKey = intentData.data.attributes.client_key;

    // --- Step 2: Create PayMongo payment method ---
    const pmType =
      payment_method === "gcash" ? "gcash"
      : payment_method === "maya" ? "paymaya"
      : "card";

    const pmPayload = {
      data: {
        attributes: { type: pmType },
      },
    };

    const pmRes = await paymongoPost("/payment_methods", pmPayload, paymongoKey);
    if (!pmRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to create payment method",
          detail: (pmRes.data as Record<string, unknown>)?.errors ?? pmRes.data,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pmData = pmRes.data as { data: { id: string } };
    const paymentMethodId = pmData.data.id;

    // --- Step 3: Attach payment method to payment intent ---
    const attachRes = await paymongoPost(
      `/payment_intents/${intentId}/attach`,
      { data: { attributes: { payment_method: paymentMethodId } } },
      paymongoKey,
    );

    if (!attachRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to attach payment method",
          detail: (attachRes.data as Record<string, unknown>)?.errors ?? attachRes.data,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const attachData = attachRes.data as {
      data: {
        id: string;
        attributes: {
          next_action?: { redirect?: { url?: string } };
        };
      };
    };

    const nextAction = attachData.data.attributes.next_action;
    const checkoutUrl = nextAction?.redirect?.url ?? null;

    // --- Step 4: Update booking with PayMongo intent reference ---
    await adminClient
      .from("bookings")
      .update({
        paymongo_payment_intent_id: intentId,
        payment_method,
        payment_status: "pending",
      })
      .eq("id", booking_id);

    return new Response(
      JSON.stringify({
        payment_intent_id: intentId,
        client_key: clientKey,
        next_action: nextAction ?? null,
        checkout_url: checkoutUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
