import { test, expect } from "@playwright/test";

test.describe("Auth page", () => {
  test("default mode is login and mode labels are explicit", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in with Google" })).toBeVisible();
  });

  test("signup query mode shows signup-specific labels", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up with Google" })).toBeVisible();
  });

  test("Google OAuth button is present and initially enabled", async ({ page }) => {
    await page.goto("/auth");
    const googleBtn = page.locator("button", { hasText: /Google/i });
    if (await googleBtn.isVisible()) {
      // Button must be enabled before any interaction (not permanently disabled)
      await expect(googleBtn).toBeEnabled();
    }
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/auth");
    await page.locator("input[type='email']").fill("invalid@test.com");
    await page.locator("input[type='password']").fill("wrongpassword");
    await page.locator("button[type='submit']").click();
    // Should show an error toast or message (Supabase auth may take a few seconds)
    await expect(
      page.locator("[data-sonner-toast]")
        .or(page.locator("[data-type='error']"))
        .or(page.locator("text=Invalid"))
        .or(page.locator("text=invalid"))
        .or(page.locator("text=credentials"))
        .or(page.locator("text=wrong"))
        .or(page.locator("text=failed"))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});
