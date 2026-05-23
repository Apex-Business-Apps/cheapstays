import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HostApplicationReview, type HostApp } from "@/features/admin/HostApplicationReview";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://example.com/signed" } })) }),
    },
  },
}));

const baseApp: HostApp = {
  id: "app-1",
  user_id: "user-1",
  full_legal_name: "Jane Doe",
  phone: "09171234567",
  property_type: "Villa",
  city: "Cebu",
  province: "Cebu",
  property_description: "Beachfront",
  id_type: "Passport",
  id_front_path: "id/front.jpg",
  selfie_path: "selfie.jpg",
  status: "pending",
  created_at: "2026-05-20T00:00:00.000Z",
};

describe("HostApplicationReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders pending and manual_review applications in review queue", () => {
    render(
      <HostApplicationReview
        hostApps={[baseApp, { ...baseApp, id: "app-2", status: "manual_review" }, { ...baseApp, id: "app-3", status: "approved" }]}
        onDecision={vi.fn(async () => {})}
      />
    );

    expect(screen.getAllByRole("button", { name: "Review" }).length).toBe(2);
    expect(screen.getByText("manual_review")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
  });

  it("calls onDecision with approve=true when approving", async () => {
    const onDecision = vi.fn(async () => {});
    render(<HostApplicationReview hostApps={[baseApp]} onDecision={onDecision} />);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve host application" }));

    await waitFor(() => expect(onDecision).toHaveBeenCalledWith("app-1", "user-1", true, undefined));
  });

  it("requires rejection reason and sends it on reject", async () => {
    const onDecision = vi.fn(async () => {});
    render(<HostApplicationReview hostApps={[baseApp]} onDecision={onDecision} />);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const rejectBtn = screen.getByRole("button", { name: "Reject" });
    expect(rejectBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Rejection reason/i), { target: { value: "Missing selfie" } });
    expect(rejectBtn).not.toBeDisabled();
    fireEvent.click(rejectBtn);

    await waitFor(() => expect(onDecision).toHaveBeenCalledWith("app-1", "user-1", false, "Missing selfie"));
  });
});
