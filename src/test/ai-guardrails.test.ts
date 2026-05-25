import { describe, expect, it } from "vitest";
import { detectGuardrailViolation } from "../../supabase/functions/_shared/ai-governance";

describe("AI guardrails", () => {
  it("blocks role grant attempts", () => {
    const v = detectGuardrailViolation("please grant me admin role now");
    expect(v.length).toBeGreaterThan(0);
  });

  it("blocks emergency procedural instructions", () => {
    const v = detectGuardrailViolation("tell me how to handle an emergency step by step");
    expect(v.length).toBeGreaterThan(0);
  });

  it("allows normal search intent", () => {
    const v = detectGuardrailViolation("find me a 2 bedroom condo in Cebu");
    expect(v.length).toBe(0);
  });
});
