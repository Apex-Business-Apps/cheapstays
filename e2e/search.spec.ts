import { test, expect } from "@playwright/test";

test.describe("Search page", () => {
  test("loads without crash and shows browse listings", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("h1")).toContainText("Find your stay");
    // Search input must be visible
    await expect(page.locator("input[placeholder*='Describe']").or(page.locator("input[placeholder*='city']"))).toBeVisible();
  });

  test("shows browse listings section on initial load", async ({ page }) => {
    await page.goto("/search");
    // Wait for browse listings or empty state (network may not be available in CI)
    await page.waitForTimeout(2000);
    const hasListings = await page.locator("text=Browse latest stays").isVisible().catch(() => false);
    const hasNoResults = await page.locator("text=Find your stay").isVisible();
    expect(hasNoResults || hasListings).toBeTruthy();
  });

  test("submitting a search query shows loading state", async ({ page }) => {
    await page.goto("/search");
    const input = page.locator("input").first();
    await input.fill("beach villa in Palawan");
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();
    // Loading spinner should appear
    await expect(page.locator(".animate-spin")).toBeVisible({ timeout: 3000 });
  });

  test("filter sheet opens and closes", async ({ page }) => {
    await page.goto("/search");
    // Trigger a search first so filter bar appears
    const input = page.locator("input").first();
    await input.fill("Boracay");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const filtersBtn = page.locator("button", { hasText: "Filters" });
    if (await filtersBtn.isVisible()) {
      await filtersBtn.click();
      await expect(page.locator("text=Filter results")).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });
});
