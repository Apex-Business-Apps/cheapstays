import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

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

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { purchase_id, success_token } = parsed.data;

  const rl = await rateLimit(`stay-voucher-resend:purchase:${purchase_id}`, 5, 60_000);
  if (!rl.ok) return json({ error: "Please wait before requesting again." }, 429);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: purchase } = await admin
    .from("stay_voucher_purchases")
    .select("id, batch_id, buyer_email, payment_status")
    .eq("id", purchase_id).eq("success_token", success_token).maybeSingle();
  if (!purchase) return json({ error: "Not found" }, 404);
  if (purchase.payment_status !== "paid") return json({ error: "Payment not completed" }, 409);

  const { data: batch } = await admin
    .from("stay_voucher_batches").select("batch_name")
    .eq("id", purchase.batch_id).single();
  const { data: codes } = await admin
    .from("stay_voucher_codes").select("code, valid_until")
    .eq("purchase_id", purchase_id).order("created_at", { ascending: true });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ sent: false, reason: "resend_not_configured" });

  const validUntil = codes?.[0]?.valid_until ?? "";
  const html = `
    <h2>Your CheapStays voucher</h2>
    <p><strong>${batch!.batch_name}</strong></p>
    <p>Valid until <strong>${new Date(validUntil).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}</strong>.</p>
    <ul>${(codes ?? []).map((c) => `<li style="font-family:monospace;font-size:20px">${c.code}</li>`).join("")}</ul>
    <p>Show your code to the host at check-in.</p>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CheapStays <no-reply@cheapstays.me>",
      to: [purchase.buyer_email],
      subject: `Your CheapStays voucher — ${codes?.[0]?.code ?? ""}`,
      html,
    }),
  });

  return json({ sent: true });
});
