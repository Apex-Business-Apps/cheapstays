import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HostDashboard } from "@/components/HostDashboard";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "host_profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { verification_status: "verified" } }) }) }) };
      }
      return {
        select: () => ({
          eq: () => ({ order: () => ({ limit: async () => ({ data: [
            { id: "1", check_in: "2026-05-25", check_out: "2026-05-28", status: "confirmed", payment_status: "pending", total_php: 9800, listings: { title: "Beach Hut" } },
          ] }) }) }),
        }),
      };
    },
  },
}));

describe("HostDashboard", () => {
  it("shows calendar legend states", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/pending payment/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/checkout pending review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dispute hold/i).length).toBeGreaterThan(0);
  });

  it("updates booking details when an event is clicked", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: /beach hut/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /beach hut/i }));
    expect(screen.getByTestId("booking-details")).toHaveTextContent(/₱9,800/);
  });
});
