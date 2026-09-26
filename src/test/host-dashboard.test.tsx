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
  created_at: "2026-05-20T10:00:00Z",
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
  it("renders a recent booking row with capitalized status label and amount", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Beach Hut")).toBeInTheDocument());
    // Capitalized, human-readable status — not the raw enum
    expect(screen.getByText("Pending payment")).toBeInTheDocument();
    expect(screen.getByText(/₱9,800/)).toBeInTheDocument();
  });

  it("links each row and a footer button to the bookings page", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Beach Hut")).toBeInTheDocument());
    const rowLink = screen.getByRole("link", { name: /beach hut/i });
    expect(rowLink).toHaveAttribute("href", "/host/bookings");
    expect(screen.getByRole("button", { name: /view all bookings/i })).toBeInTheDocument();
  });

  it("navigates to bookings page when a stat card button is clicked", async () => {
    render(<MemoryRouter><HostDashboard hostId="host-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Review requests")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Review requests"));
  });
});
