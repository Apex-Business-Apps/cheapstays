import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Auth from "@/pages/Auth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({})),
    },
  },
}));

function renderAuth(path = "/auth") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Auth mode labels", () => {
  it("default login mode shows login-specific labels", () => {
    renderAuth("/auth");
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in with Google" })).toBeInTheDocument();
  });

  it("signup query mode shows signup-specific labels", () => {
    renderAuth("/auth?mode=signup");
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up with Google" })).toBeInTheDocument();
  });

  it("mode switch updates visible labels", () => {
    renderAuth("/auth");
    fireEvent.click(screen.getByRole("button", { name: "Don't have an account? Sign up" }));
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up with Google" })).toBeInTheDocument();
  });
});
