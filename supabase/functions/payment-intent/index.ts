import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  client_amount: z.number().int().positive().optional(),
});

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function paymongoHeaders(secretKey: string, idempotencyKey: string): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "Manual card-hold is intentionally disabled pending full production implementation. Please use hosted checkout." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
