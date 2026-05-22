import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HostDashboard } from "@/components/HostDashboard";

describe("HostDashboard", () => {
  it("shows calendar legend states", () => {
    render(<HostDashboard />);
    expect(screen.getAllByText(/pending payment/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/checkout pending review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dispute hold/i).length).toBeGreaterThan(0);
  });

  it("updates booking details when an event is clicked", () => {
    render(<HostDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /beach hut/i }));
    expect(screen.getByTestId("booking-details")).toHaveTextContent(/Jules K\./);
  });
});
