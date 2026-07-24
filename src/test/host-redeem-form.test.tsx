import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HostRedeemForm } from "@/components/stay-vouchers/HostRedeemForm";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const invoke = vi.hoisted(() =>
  vi.fn(async (name: string) => {
    if (name === "host-stay-voucher-preview") {
      return { data: {
        batch_name: "Motel deal", nights: 1, price_php: 1999,
        buyer_name: "Ana", valid_until: "2026-08-06T00:00:00Z", status: "unclaimed",
        listing: { id: "l1", title: "Villa X" },
      }, error: null };
    }
    return { data: { success: true, booking_id: "book-1" }, error: null };
  })
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [
        { id: "l1", title: "Villa X" }
      ] }) }) }) }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, roles: ["host"] }) }));

describe("<HostRedeemForm>", () => {
  it("auto-uppercases the code as the host types", () => {
    render(<HostRedeemForm />);
    const input = screen.getByLabelText(/voucher code/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "cs-abcd-1234" } });
    expect(input.value).toBe("CS-ABCD-1234");
  });

  it("calls preview then redeem", async () => {
    render(<HostRedeemForm />);
    fireEvent.change(screen.getByLabelText(/voucher code/i), { target: { value: "CS-AAAA-BBBB" } });
    // wait for listings load then select
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l1" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/motel deal/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/check-in/i), { target: { value: "2026-07-24" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm redemption/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("host-stay-voucher-redeem", expect.any(Object)));
  });
});
