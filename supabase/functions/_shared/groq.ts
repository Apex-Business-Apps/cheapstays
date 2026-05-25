const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqMessage = { role: "system" | "user" | "assistant"; content: string };

export async function groqChat(opts: {
  messages: GroqMessage[];
  model?: string;
  json?: boolean;
  temperature?: number;
}) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "llama-3.3-70b-versatile",
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
