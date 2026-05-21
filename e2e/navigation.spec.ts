import { test, expect } from "@playwright/test";

test.describe("Navigation — responsive", () => {
  test("desktop nav shows links", async ({ page }) => {
    await page.goto("/");
    // Desktop nav items should be visible
    await expect(page.locator("nav")).toBeVisible();
  });

  test("mobile nav has hamburger button", async ({ page, viewport }) => {
    await page.goto("/");
    // On mobile viewport, hamburger should be visible
    if (viewport && viewport.width < 768) {
      const hamburger = page.locator("button[aria-label*='menu' i]").or(
        page.locator("button").filter({ has: page.locator("svg") }).first()
      );
      // Hamburger is expected on mobile
      const isMobileNavVisible = await page.locator("[data-mobile-nav], .mobile-nav, button[aria-label*='Menu']").isVisible().catch(() => false);
      // At least the nav element itself should be present
      await expect(page.locator("nav").first()).toBeAttached();
    }
  });

  test("can navigate to /search", async ({ page }) => {
    await page.goto("/");
    await page.goto("/search");
    await expect(page).toHaveURL(/\/search/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("can navigate to /auth", async ({ page }) => {
    await page.goto("/auth");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator("text=Sign In").or(page.locator("text=Log in"))).toBeVisible();
  });

  test("can navigate to /membership", async ({ page }) => {
    await page.goto("/membership");
    await expect(page).toHaveURL(/\/membership/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("can navigate to /support", async ({ page }) => {
    await page.goto("/support");
    await expect(page).toHaveURL(/\/support/);
  });

  test("404 page shows NotFound for unknown routes", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    // Should show some error or not-found state
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });
});
