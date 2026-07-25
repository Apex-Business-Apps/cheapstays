import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { checkPaymongoSessionPaid, markPaidAndMintCodes } from "../_shared/stay-voucher-mint.ts";

const BodySchema = z.object({
  purchase_id: z.string().uuid(),
  success_token: z.string().min(8).max(64),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await rateLimit(`stay-voucher-purchase-lookup:${ip}`, 30, 60_000);
  if (!rl.ok) return json({ error: "Too many requests" }, 429);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { purchase_id, success_token } = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, batch_id, payment_status, paid_at, payment_ref")
    .eq("id", purchase_id)
    .eq("success_token", success_token)
    .maybeSingle();
  if (!purchase) return json({ error: "Not found" }, 404);

  const { data: batch } = await admin
    .from("stay_voucher_batches")
    .select("id, batch_name, nights, price_php, valid_days, listing_id")
    .eq("id", purchase.batch_id).single();

  const { data: listing } = await admin
    .from("listings").select("id, title, city").eq("id", batch!.listing_id).single();

  // Self-heal: if still pending and we have a PayMongo session id, ask PayMongo
  // directly. If PayMongo says paid, transition + mint codes right now — makes
  // the flow resilient to a broken/misconfigured/slow webhook.
  if (purchase.payment_status === "pending" && purchase.payment_ref) {
    const paymongo = await checkPaymongoSessionPaid(purchase.payment_ref);
    if (paymongo.paid) {
      await markPaidAndMintCodes(admin, purchase.id);
      // Re-read the purchase after mint
      const refreshed = await admin
        .from("stay_voucher_purchases")
        .select("id, batch_id, payment_status, paid_at, payment_ref")
        .eq("id", purchase_id).maybeSingle();
      if (refreshed.data) purchase = refreshed.data;
    }
  }

  if (purchase.payment_status !== "paid") {
    return json({
      payment_status: purchase.payment_status, codes: null,
      batch: { name: batch!.batch_name, nights: batch!.nights, price_php: batch!.price_php,
               valid_until: null, listing },
    });
  }

  const { data: codes } = await admin
    .from("stay_voucher_codes")
    .select("code, valid_until")
    .eq("purchase_id", purchase_id)
    .order("created_at", { ascending: true });

  return json({
    payment_status: "paid",
    codes: (codes ?? []).map((c) => c.code),
    batch: {
      name: batch!.batch_name, nights: batch!.nights, price_php: batch!.price_php,
      valid_until: codes?.[0]?.valid_until ?? null,
      listing,
    },
  });
});
