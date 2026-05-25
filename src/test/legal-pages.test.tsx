import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LegalDocumentPage } from "@/pages/legal/LegalDocumentPage";
import { legalDocs } from "@/pages/legal/content";
import { Layout } from "@/components/Layout";

vi.mock("@/components/Navbar", () => ({ Navbar: () => <div data-testid="navbar" /> }));
vi.mock("@/components/AiChatBubble", () => ({ AiChatBubble: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (v: string) => v }) }));

describe("legal document routes", () => {
  it("renders all public legal documents from markdown", () => {
    for (const [key, doc] of Object.entries(legalDocs)) {
      render(<MemoryRouter><LegalDocumentPage docKey={key as keyof typeof legalDocs} /></MemoryRouter>);
      expect(screen.getByRole("heading", { level: 1, name: doc.title })).toBeInTheDocument();
      expect(screen.getByText(/Version v1.0/i)).toBeInTheDocument();
      cleanup();
    }
  });

  it("layout footer exposes all policy links", () => {
    render(<MemoryRouter><Layout><div>Body</div></Layout></MemoryRouter>);

    expect(screen.getByRole("link", { name: /Legal Center/i })).toHaveAttribute("href", "/legal");
    Object.values(legalDocs).forEach((doc) => {
      if (doc.path === "/legal") return;
      expect(screen.getByRole("link", { name: doc.title })).toHaveAttribute("href", doc.path);
    });
  });
});
