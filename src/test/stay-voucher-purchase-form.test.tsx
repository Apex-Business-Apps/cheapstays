import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoucherPurchaseForm } from "@/components/stay-vouchers/VoucherPurchaseForm";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async () => ({ data: { checkout_url: "https://example.com/pay" }, error: null })),
    },
  },
}));

describe("<VoucherPurchaseForm>", () => {
  const batch = {
    id: "b1", batch_name: "Motel deal", nights: 1,
    price_php: 1999, valid_days: 14, listing_title: "Villa X",
  };

  it("disables submit until the rules checkbox is checked", () => {
    render(<VoucherPurchaseForm batch={batch} />);
    const btn = screen.getByRole("button", { name: /buy voucher/i });
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/i understand.*non-refundable/i));
    // still disabled until fields filled
    fireEvent.change(screen.getByLabelText(/name/i),  { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+639171234567" } });
    expect(btn).not.toBeDisabled();
  });

  it("calls stay-voucher-checkout with the selected payment method", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    // window.location.assign is a JSDOM stub — spy it
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign }, writable: true });
    render(<VoucherPurchaseForm batch={batch} />);
    fireEvent.click(screen.getByLabelText(/i understand.*non-refundable/i));
    fireEvent.change(screen.getByLabelText(/name/i),  { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+639171234567" } });
    fireEvent.click(screen.getByRole("button", { name: /buy voucher/i }));
    await waitFor(() => {
      expect((supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>))
        .toHaveBeenCalledWith("stay-voucher-checkout", expect.objectContaining({
          body: expect.objectContaining({
            batch_id: "b1", quantity: 1, buyer_name: "Ana", buyer_email: "a@b.co",
            buyer_phone: "+639171234567", accept_terms: true,
          }),
        }));
    });
    expect(assign).toHaveBeenCalledWith("https://example.com/pay");
  });
});
