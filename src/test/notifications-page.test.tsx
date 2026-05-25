import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Notifications from "@/pages/Notifications";
import { Navbar } from "@/components/Navbar";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, roles: [], signOut: vi.fn() }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (v: string) => v, i18n: { language: "en", changeLanguage: vi.fn() } }) };
});
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ items: [], loading: false, unreadCount: 0, markAllRead: vi.fn(), markAsRead: vi.fn() }),
}));
vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({ supported: false, permission: "default", isSubscribed: false, subscribe: vi.fn(), unsubscribe: vi.fn() }),
}));
vi.mock("@/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: () => ({
    prefs: {
      email_enabled: true, in_app_enabled: true, push_enabled: true,
      booking_updates: true, payment_updates: true, verification_updates: true,
      host_status_updates: true, check_in_updates: true, refund_updates: true,
      payout_updates: true, support_updates: true, evidence_updates: true,
      dispute_updates: true, safety_critical_updates: true, marketing_enabled: false,
    },
    loading: false,
    saving: false,
    update: vi.fn(),
  }),
}));

describe("Notifications page", () => {
  it("requires sign in when unauthenticated", () => {
    render(<MemoryRouter><Notifications /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to view your notification center/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute("href", "/auth");
  });

  it("renders /notifications with navbar on desktop without crashing", () => {
    render(
      <MemoryRouter>
        <Navbar />
        <Notifications />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: /Notifications/i })).toBeInTheDocument();
  });
});
