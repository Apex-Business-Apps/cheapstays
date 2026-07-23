import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HostWalletCard } from "@/components/wallet/HostWalletCard";

vi.mock("@/integrations/supabase/client", () => {
  const chain = (result: unknown) => ({
    select: () => chain(result),
    eq: () => chain(result),
    or: () => chain(result),
    order: () => chain(result),
    limit: () => chain(result),
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
  });

  return {
    supabase: {
      from: (table: string) => {
        if (table === "host_wallets") {
          return chain({
            data: {
              id: "w1", host_id: "h1", available_balance: 750, pending_balance: 0,
              currency: "PHP", is_frozen: false, created_at: "", updated_at: "",
            },
          });
        }
        if (table === "host_payout_accounts") {
          return chain({ data: { is_verified: true } });
        }
        if (table === "disbursement_requests") {
          return chain({ data: null });
        }
        return chain({ data: null });
      },
      functions: { invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })) },
    },
  };
});

beforeEach(() => vi.clearAllMocks());

describe("HostWalletCard — request-payout button", () => {
  it("renders a Request Payout button when balance >= 500 and account verified", async () => {
    render(<HostWalletCard />);
    const button = await screen.findByRole("button", { name: /request payout/i });
    expect(button).toBeEnabled();
  });
});
