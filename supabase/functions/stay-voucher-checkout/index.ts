import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const PAYMONGO_BASE = "https://api.paymongo.com/v1";
const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const BodySchema = z.object({
  batch_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  buyer_name: z.string().min(1).max(120),
  buyer_email: z.string().email().max(200),
  buyer_phone: z.string().min(6).max(30),
  payment_method: z.enum(["gcash", "maya", "card"]),
  accept_terms: z.literal(true),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mintSuccessToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CROCKFORD[b % CROCKFORD.length]).join("");
}

function pmHeaders(key: string, idempotencyKey: string) {
  return {
    Authorization: `Basic ${btoa(`${key}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`stay-voucher-checkout:${ip}`, 10, 60_000);
  if (!rl.ok) return json({ error: "Too many requests. Try again in a minute." }, 429);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { batch_id, quantity, buyer_name, buyer_email, buyer_phone, payment_method } = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: batch } = await admin
    .from("stay_voucher_batches")
    .select("id, listing_id, batch_name, nights, price_php, quantity, valid_days, is_active")
    .eq("id", batch_id)
    .maybeSingle();
  if (!batch) return json({ error: "Voucher not found." }, 404);
  if (!batch.is_active) return json({ error: "This voucher is no longer available." }, 409);

  // Count unclaimed codes remaining in the batch for stock check
  const { count: unclaimed = 0 } = await admin
    .from("stay_voucher_codes")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch_id)
    .eq("status", "unclaimed");
  if ((unclaimed ?? 0) < quantity) {
    return json({ error: "Not enough vouchers left in this batch." }, 409);
  }

  const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!paymongoKey) return json({ error: "Payment gateway not configured" }, 503);
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://cheapstays.me";

  const subtotal_php = batch.price_php * quantity;

  // Mint the success_token server-side before inserting the purchase row
  const success_token = mintSuccessToken();

  const { data: purchase, error: pErr } = await admin
    .from("stay_voucher_purchases")
    .insert({
      batch_id,
      quantity,
      buyer_name,
      buyer_email,
      buyer_phone,
      subtotal_php,
      payment_method,
      success_token,
      payment_status: "pending",
    })
    .select("id")
    .single();
  if (pErr || !purchase) return json({ error: pErr?.message ?? "Failed to create purchase" }, 500);

  const pmMethod: Record<string, string[]> = { gcash: ["gcash"], maya: ["paymaya"], card: ["card"] };
  const idempotencyKey = `stay-voucher-checkout:${purchase.id}:${payment_method}:v1`;

  const sessionRes = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
    method: "POST",
    headers: pmHeaders(paymongoKey, idempotencyKey),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              currency: "PHP",
              amount: subtotal_php * 100,
              name: `Voucher: ${batch.batch_name}`,
              description: `${batch.nights} night${batch.nights === 1 ? "" : "s"} · ${quantity} voucher${quantity === 1 ? "" : "s"}`,
              quantity: 1,
            },
          ],
          payment_method_types: pmMethod[payment_method],
          success_url: `${siteUrl}/stay-vouchers/success?purchase=${purchase.id}&token=${success_token}`,
          cancel_url: `${siteUrl}/stay-vouchers/${batch_id}?cancelled=1`,
          metadata: { purchase_id: purchase.id, kind: "stay_voucher" },
        },
      },
    }),
  });

  const pmJson = await sessionRes.json() as {
    data?: { id: string; attributes: { checkout_url: string } };
    errors?: { detail: string }[];
  };

  if (!sessionRes.ok || !pmJson.data?.attributes?.checkout_url) {
    return json({ error: pmJson.errors?.[0]?.detail ?? "Payment provider error" }, 502);
  }

  // Persist the PayMongo checkout session id onto the purchase row via payment_ref
  await admin
    .from("stay_voucher_purchases")
    .update({ payment_ref: pmJson.data.id })
    .eq("id", purchase.id);

  return json(
    {
      checkout_url: pmJson.data.attributes.checkout_url,
      purchase_id: purchase.id,
      success_token,
    },
    200,
  );
});
