import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostDisbursementList } from "@/components/wallet/HostDisbursementList";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                {
                  id: "d1", wallet_id: "w1", amount: 750, status: "awaiting_confirmation",
                  payout_method: "GCASH", proof_image_path: "w1/d1.png", admin_note: "Sent via GCash",
                  released_at: new Date().toISOString(), requested_at: new Date().toISOString(),
                  confirmed_at: null, rejected_at: null, rejection_reason: null, trigger: "manual",
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://example/img.png" }, error: null }),
        }),
      },
      functions: { invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })) },
    },
  };
});

describe("HostDisbursementList", () => {
  it("renders a confirm-received button for awaiting_confirmation rows", async () => {
    render(<HostDisbursementList />);
    expect(await screen.findByRole("button", { name: /confirm received/i })).toBeInTheDocument();
  });

  it("renders the admin note when present", async () => {
    render(<HostDisbursementList />);
    expect(await screen.findByText(/Sent via GCash/)).toBeInTheDocument();
  });
});
