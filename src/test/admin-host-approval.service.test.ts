import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitHostApplicationDecision } from "@/features/admin/adminHostApproval.service";

const invokeMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: () => ({
      update: (...args: unknown[]) => updateMock(...args),
    }),
  },
}));

describe("submitHostApplicationDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockResolvedValue({ error: null });
    invokeMock.mockResolvedValue({ error: null });
  });

  it("approves via approve-host-application function", async () => {
    await submitHostApplicationDecision({
      applicationId: "app-1",
      targetUserId: "user-1",
      approve: true,
    });

    expect(invokeMock).toHaveBeenCalledWith("approve-host-application", {
      body: {
        application_id: "app-1",
        target_user_id: "user-1",
        reason_code: "host-application-approved",
        reviewer_notes: "Approved in admin host application review.",
      },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects by updating host_applications status", async () => {
    await submitHostApplicationDecision({
      applicationId: "app-2",
      targetUserId: "user-2",
      reviewerId: "admin-1",
      approve: false,
      reason: "missing evidence",
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reviewed_by: "admin-1",
        rejection_reason: "missing evidence",
      })
    );
    expect(eqMock).toHaveBeenCalledWith("id", "app-2");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("throws when function approval fails", async () => {
    invokeMock.mockResolvedValue({ error: new Error("denied") });

    await expect(
      submitHostApplicationDecision({ applicationId: "app-3", targetUserId: "user-3", approve: true })
    ).rejects.toThrow("denied");
  });

  it("throws when rejection update fails", async () => {
    eqMock.mockResolvedValue({ error: new Error("db failed") });

    await expect(
      submitHostApplicationDecision({ applicationId: "app-4", targetUserId: "user-4", approve: false })
    ).rejects.toThrow("db failed");
  });
});
