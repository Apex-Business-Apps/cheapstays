import { render, screen } from "@testing-library/react";
import { describe, it, vi, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

const mockAuth = { user: null as object | null, roles: [] as string[], signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mockAuth }));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (v: string) => v, i18n: { language: "en", changeLanguage: vi.fn() } }) };
});

describe("Navbar CTAs", () => {
  it("logged-out: shows separate Log in and Sign up actions, no Apply as Host", () => {
    mockAuth.user = null;
    mockAuth.roles = [];
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    expect(screen.getAllByText("Log in").length).toBe(1);
    expect(screen.getAllByText("Sign up").length).toBe(1);
    expect(screen.queryByText("Sign Up / Log In")).not.toBeInTheDocument();
    expect(screen.queryByText("Apply as Host")).not.toBeInTheDocument();
  });

  it("logged-in non-host: shows Apply as Host and Sign Out, no logged-out auth actions", () => {
    mockAuth.user = { id: "u1", email: "user@test.com" };
    mockAuth.roles = ["user"];
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
    expect(screen.getByText("Apply as Host")).toBeInTheDocument();
  });

  it("logged-in host: shows Sign Out only, no Host tools button or Apply as Host", () => {
    mockAuth.user = { id: "u1", email: "host@test.com" };
    mockAuth.roles = ["host"];
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
    expect(screen.queryByText("Apply as Host")).not.toBeInTheDocument();
    expect(screen.queryByText("Host tools")).not.toBeInTheDocument();
  });


  it("renders exactly one Host nav link in header when menu is closed", () => {
    mockAuth.user = { id: "u2", email: "member@test.com" };
    mockAuth.roles = ["user"];
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    const hostLinks = screen.getAllByRole("link", { name: "nav.host" });
    expect(hostLinks).toHaveLength(1);
    expect(hostLinks[0]).toHaveAttribute("href", "/host");
  });
});
