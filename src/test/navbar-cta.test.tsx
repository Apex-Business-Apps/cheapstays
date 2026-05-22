import { render, screen } from "@testing-library/react";
import { describe, it, vi, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, roles: [], signOut: vi.fn() }) }));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (v: string) => v, i18n: { language: "en", changeLanguage: vi.fn() } }) };
});

describe("Navbar CTAs", () => {
  it("shows single primary auth CTA and apply host CTA", () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    expect(screen.getAllByText("Sign Up / Log In").length).toBe(1);
    expect(screen.getByText("Apply as Host")).toBeInTheDocument();
  });
});
