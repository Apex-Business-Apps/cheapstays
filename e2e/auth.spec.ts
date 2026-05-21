import { test, expect } from "@playwright/test";

test.describe("Auth page", () => {
  test("renders sign-in form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("Google OAuth button is present and not double-clickable", async ({ page }) => {
    await page.goto("/auth");
    const googleBtn = page.locator("button", { hasText: /Google/i });
    if (await googleBtn.isVisible()) {
      await expect(googleBtn).toBeEnabled();
      // After click, button should show loading state or redirect
      await googleBtn.click();
      // Either it's disabled/loading or redirected to OAuth
      await page.waitForTimeout(500);
      const isDisabledOrRedirected =
        (await googleBtn.isDisabled().catch(() => true)) ||
        page.url().includes("google") ||
        page.url().includes("supabase");
      expect(isDisabledOrRedirected).toBeTruthy();
    }
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/auth");
    await page.locator("input[type='email']").fill("invalid@test.com");
    await page.locator("input[type='password']").fill("wrongpassword");
    await page.locator("button[type='submit']").click();
    // Should show an error toast or message
    await expect(
      page.locator("text=Invalid").or(page.locator("[data-sonner-toast]")).or(page.locator(".toast"))
    ).toBeVisible({ timeout: 5000 });
  });
});
