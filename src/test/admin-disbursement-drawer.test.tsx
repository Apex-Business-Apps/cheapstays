import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminDisbursementDrawer } from "@/components/wallet/AdminDisbursementDrawer";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    }),
    storage: { from: () => ({ upload: vi.fn() }) },
    functions: { invoke: vi.fn() },
  },
}));

const request = {
  id: "d1", wallet_id: "w1", amount: 750, status: "pending" as const,
  payout_method: "GCASH" as const, xendit_disbursement_id: null,
  failure_reason: null, retry_count: 0, retry_after: null,
  requested_at: new Date().toISOString(), processed_at: null,
  cycle_month: "2026-07", proof_image_path: null, admin_note: null,
  released_by: null, released_at: null, confirmed_at: null,
  rejected_by: null, rejected_at: null, rejection_reason: null,
  trigger: "manual" as const,
};

describe("AdminDisbursementDrawer", () => {
  it("shows Save proof for a pending request", async () => {
    render(<AdminDisbursementDrawer request={request} open onClose={() => {}} onUpdated={() => {}} />);
    expect(await screen.findByRole("button", { name: /save proof/i })).toBeInTheDocument();
  });

  it("shows Reject request for pending", async () => {
    render(<AdminDisbursementDrawer request={request} open onClose={() => {}} onUpdated={() => {}} />);
    expect(await screen.findByRole("button", { name: /reject request/i })).toBeInTheDocument();
  });
});
