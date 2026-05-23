import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("Missing required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anonClient = createClient(url, anon);
const serviceClient = createClient(url, service);

async function run() {
  const { error: unauthErr } = await anonClient.functions.invoke("approve-host-application", {
    body: {
      application_id: "00000000-0000-0000-0000-000000000000",
      target_user_id: "00000000-0000-0000-0000-000000000000",
      reason_code: "validation-check",
      reviewer_notes: "integration validation",
    },
  });

  if (!unauthErr) throw new Error("Expected unauthorized invocation to fail, but it succeeded");

  const { error: updateErr } = await serviceClient
    .from("host_applications")
    .update({ status: "manual_review" })
    .eq("id", "00000000-0000-0000-0000-000000000000");

  if (updateErr && /host_applications_status_check/i.test(updateErr.message)) {
    throw new Error(`manual_review not allowed by DB constraint: ${updateErr.message}`);
  }

  console.log("Host approval validation checks passed.");
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
