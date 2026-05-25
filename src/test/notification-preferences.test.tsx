import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";

const upsertMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, roles: [] }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
      upsert: (...args: unknown[]) => upsertMock(...args),
    }),
  },
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

describe("useNotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    upsertMock.mockResolvedValue({ error: null });
  });

  it("loads default preferences when no DB row exists", async () => {
    const { result } = renderHook(() => useNotificationPreferences());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.prefs.email_enabled).toBe(true);
    expect(result.current.prefs.marketing_enabled).toBe(false);
  });

  it("merges DB row into defaults", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { email_enabled: false, marketing_enabled: true, booking_updates: false },
      error: null,
    });
    const { result } = renderHook(() => useNotificationPreferences());
    await act(async () => {});
    expect(result.current.prefs.email_enabled).toBe(false);
    expect(result.current.prefs.marketing_enabled).toBe(true);
    expect(result.current.prefs.booking_updates).toBe(false);
    expect(result.current.prefs.in_app_enabled).toBe(true); // default
  });

  it("calls upsert when update() is invoked", async () => {
    const { result } = renderHook(() => useNotificationPreferences());
    await act(async () => {});
    await act(async () => {
      await result.current.update({ email_enabled: false });
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", email_enabled: false }),
      { onConflict: "user_id" },
    );
  });
});
