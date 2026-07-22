// PAUSED 2026-07-22 — replaced by host-controlled manual disbursements
// (see /docs/superpowers/plans/2026-07-22-host-controlled-disbursement.md).
//
// The pg_cron schedule "cheapstays-monthly-host-payouts" was removed in
// migration 20260722000000_host_controlled_disbursements.sql, so nothing
// invokes this function on a schedule. If manually called it now no-ops.
//
// The full Xendit sweep logic is retained below in a /* PAUSED ... */
// block for reference; do not re-enable without a product decision.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(() => {
  return new Response(
    JSON.stringify({
      "disabled": true,
      reason: "manual-flow-active",
      migratedTo: "request-disbursement + admin-attach-disbursement-proof + host-confirm-disbursement",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

/* PAUSED
// Original Xendit-based monthly sweep. Kept for reference only.
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// import { decrypt } from '../_shared/encryption.ts';
//
// const MINIMUM_PAYOUT = 500;
// ... (rest of the pre-2026-07-22 implementation) ...
// await fetch('https://api.xendit.co/disbursements', { ... });
PAUSED */
