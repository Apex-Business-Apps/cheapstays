import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ConsentGate } from "@/components/ConsentGate";

// Mock useAuth so we can drive consent states directly.
const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (v: string) => v }),
}));

describe("ConsentGate — recovery CTA", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    cleanup();
  });

  it("renders children when consent is not required", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1" },
      consentReady: true,
      consentRequired: false,
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ConsentGate>
          <div data-testid="child">ok</div>
        </ConsentGate>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("blocks children and points CTA to /legal/accept when consent required", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1" },
      consentReady: true,
      consentRequired: true,
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ConsentGate>
          <div data-testid="child">ok</div>
        </ConsentGate>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Review and accept now/i });
    expect(cta).toHaveAttribute("href", "/legal/accept");
    // Regression guard: must NOT point to /auth?mode=signup anymore.
    expect(cta.getAttribute("href")).not.toContain("/auth?mode=signup");
  });

  it("does not block when user is on /legal/accept itself", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1" },
      consentReady: true,
      consentRequired: true,
    });
    render(
      <MemoryRouter initialEntries={["/legal/accept"]}>
        <Routes>
          <Route
            path="/legal/accept"
            element={
              <ConsentGate>
                <div data-testid="accept-page">accept</div>
              </ConsentGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("accept-page")).toBeInTheDocument();
  });
});
