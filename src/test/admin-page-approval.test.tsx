import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Admin from "@/pages/Admin";

const submitDecisionMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

const authState = { user: { id: "admin-1" }, roles: ["admin"], loading: false };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/admin/adminHostApproval.service", () => ({
  submitHostApplicationDecision: (...args: unknown[]) => submitDecisionMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("@/features/admin/HostApplicationReview", () => ({
  HostApplicationReview: ({ onDecision }: { onDecision: (appId: string, userId: string, approve: boolean, reason?: string) => Promise<void> }) => (
    <div>
      <button onClick={() => onDecision("app-1", "user-1", true)}>approve</button>
      <button onClick={() => onDecision("app-2", "user-2", false, "bad docs")}>reject</button>
    </div>
  ),
}));

function tableResponse(data: unknown[] = []) {
  return {
    select: () => ({
      order: () => ({ limit: async () => ({ data, error: null }) }),
      limit: async () => ({ data, error: null }),
    }),
  };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "user_roles") return { select: () => ({ order: () => ({ data: [], error: null }) }) };
      return tableResponse([]);
    },
  },
}));

describe("Admin host approval messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success only after approve decision resolves", async () => {
    submitDecisionMock.mockResolvedValueOnce(undefined);
    render(<MemoryRouter><Admin /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() => expect(submitDecisionMock).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Application approved and host status confirmed."));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows error and no success when approve decision fails", async () => {
    submitDecisionMock.mockRejectedValueOnce(new Error("authority unavailable"));
    render(<MemoryRouter><Admin /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Failed: authority unavailable"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
