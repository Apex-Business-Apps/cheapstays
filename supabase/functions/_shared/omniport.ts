export type OmniportEndpoint =
  | "telemetry"
  | "actions"
  | "data_events"
  | "audit_events"
  | "support_events";

const PATHS: Record<OmniportEndpoint, string> = {
  telemetry: "/v1/telemetry",
  actions: "/v1/actions",
  data_events: "/v1/data/events",
  audit_events: "/v1/audit/events",
  support_events: "/v1/support/events",
};

export async function omniportEmit(endpoint: OmniportEndpoint, body: Record<string, unknown>) {
  const baseUrl = Deno.env.get("OMNIPORT_BASE_URL");
  const token = Deno.env.get("OMNIPORT_TOKEN");
  if (!baseUrl || !token) return;

  await fetch(`${baseUrl}${PATHS[endpoint]}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
