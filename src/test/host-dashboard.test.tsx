import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HostDashboard } from "@/components/HostDashboard";
import { MemoryRouter } from "react-router-dom";

const mockBooking = {
  id: "1",
  check_in: "2026-05-25",
  check_out: "2026-05-28",
  status: "confirmed",
  payment_status: "pending",
  total_php: 9800,
  listings: { title: "Beach Hut" },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "host_profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { verification_status: "verified" } }) }),
          }),
        };
      }
      if (table === "listings") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: 2, data: null, error: null }),
            }),
          }),
        };
      }
      // bookings
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [mockBooking], error: null }),
            }),
          }),
        }),
      };
    },
  },
}));

describe("HostDashboard", () => {
  it("renders status legend labels", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" onTabChange={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/confirmed/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/pending payment/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/checkout pending review/i).length).toBeGreaterThan(0);
  });

  it("shows booking details when an event is clicked", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" onTabChange={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: /beach hut/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /beach hut/i }));
    expect(screen.getByTestId("booking-details")).toHaveTextContent(/₱9,800/);
  });

  it("calls onTabChange when a stat card button is clicked", async () => {
    const onTabChange = vi.fn();
    render(<MemoryRouter><HostDashboard hostId="host-1" onTabChange={onTabChange} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Review requests")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Review requests"));
    expect(onTabChange).toHaveBeenCalledWith("bookings");
  });
});
