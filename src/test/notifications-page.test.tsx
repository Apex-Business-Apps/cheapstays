import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Notifications from "@/pages/Notifications";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, roles: [], signOut: vi.fn() }) }));
// Force desktop mode so the page renders rather than redirecting or returning null.
vi.mock("@/hooks/use-mobile", () => ({ useIsDesktop: () => true, useIsMobile: () => false }));

describe("Notifications page", () => {
  it("requires sign in when unauthenticated", () => {
    render(<MemoryRouter><Notifications /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to view your notification center/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute("href", "/auth");
  });
});
