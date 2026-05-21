import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PAYMONGO_WEBHOOK_SECRET_HEADER = "paymongo-signature";

/**
 * Constant-time comparison to prevent timing attacks.
 * Both strings are encoded to bytes and compared byte-by-byte, accumulating
 * differences so the runtime does not short-circuit on a mismatch.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  // If lengths differ, we still iterate the full shorter length to avoid a
  // trivially detectable timing side-channel, then return false.
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Verify PayMongo webhook signature using HMAC-SHA256.
 * PayMongo sends: t=<timestamp>,li=<live-sig>,te=<test-sig>
 * We reconstruct the signed payload as "<timestamp>.<raw-body>" and compare
 * using constant-time comparison to prevent timing attacks.
 */
async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [k, v] = segment.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }

  const timestamp = parts["t"];
  const receivedSig = parts["li"] ?? parts["te"];
  if (!timestamp || !receivedSig) return false;

  const message = `${timestamp}.${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computed, receivedSig);
}

Deno.serve(async (req) => {
  // PayMongo sends POST; OPTIONS not needed but handle gracefully
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    const isProduction = Deno.env.get("ENVIRONMENT") === "production";

    // In production, a missing webhook secret is a configuration error — reject all events.
    if (!webhookSecret && isProduction) {
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured. Contact support." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify signature when secret is configured; in non-production with no secret,
    // unsigned events are accepted for local/demo testing only.
    if (webhookSecret) {
      const sigHeader = req.headers.get(PAYMONGO_WEBHOOK_SECRET_HEADER) ?? "";
      if (!sigHeader) {
        return new Response(JSON.stringify({ error: "Missing signature header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifySignature(rawBody, sigHeader, webhookSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // No secret and not production — log a warning so operators notice.
      console.warn("PAYMONGO_WEBHOOK_SECRET not set; skipping signature verification (demo mode).");
    }

    let event: {
      data: {
        type: string;
        attributes: {
          type: string;
          data: {
            attributes: {
              metadata?: { booking_id?: string };
              status?: string;
              payment_intent_id?: string;
            };
          };
        };
      };
    };

    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = event?.data?.attributes?.type;
    const paymentAttrs = event?.data?.attributes?.data?.attributes;
    const bookingId = paymentAttrs?.metadata?.booking_id;
    const paymentIntentId = paymentAttrs?.payment_intent_id;

    if (!eventType) {
      return new Response(JSON.stringify({ received: true, skipped: "no event type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve booking_id from metadata or from payment_intent_id stored on booking
    let resolvedBookingId: string | null = bookingId ?? null;

    if (!resolvedBookingId && paymentIntentId) {
      const { data: found } = await adminClient
        .from("bookings")
        .select("id")
        .eq("paymongo_payment_intent_id", paymentIntentId)
        .maybeSingle();
      resolvedBookingId = found?.id ?? null;
    }

    if (!resolvedBookingId) {
      return new Response(
        JSON.stringify({ received: true, skipped: "no booking_id resolvable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (eventType === "payment.paid") {
      // Idempotent: only update if the booking is not already in "paid"/"confirmed" state.
      // This ensures a replayed or duplicate webhook does not trigger unintended side-effects.
      const { data: existing } = await adminClient
        .from("bookings")
        .select("payment_status, status")
        .eq("id", resolvedBookingId)
        .maybeSingle();

      if (existing && existing.payment_status === "paid" && existing.status === "confirmed") {
        return new Response(
          JSON.stringify({ received: true, action: "already_confirmed", booking_id: resolvedBookingId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminClient
        .from("bookings")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", resolvedBookingId)
        .in("payment_status", ["pending", "unpaid"]);

      return new Response(
        JSON.stringify({ received: true, action: "payment_confirmed", booking_id: resolvedBookingId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (eventType === "payment.failed") {
      // Idempotent: only update if still in "pending" state; ignore if already failed or paid.
      const { data: existing } = await adminClient
        .from("bookings")
        .select("payment_status")
        .eq("id", resolvedBookingId)
        .maybeSingle();

      if (existing && existing.payment_status !== "pending") {
        return new Response(
          JSON.stringify({ received: true, action: "already_settled", booking_id: resolvedBookingId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminClient
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", resolvedBookingId)
        .eq("payment_status", "pending");

      return new Response(
        JSON.stringify({ received: true, action: "payment_failed", booking_id: resolvedBookingId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Unhandled event type — acknowledge receipt
    return new Response(
      JSON.stringify({ received: true, skipped: `unhandled event: ${eventType}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
