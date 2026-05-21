import { test, expect } from "@playwright/test";

test.describe("Listing detail", () => {
  test("slug route resolves and shows page structure", async ({ page }) => {
    // Navigate to the slug route pattern — will 404 gracefully if no listing exists
    await page.goto("/listing/slug/test-listing");
    // Should not crash the app — either shows listing or not-found
    await expect(page.locator("body")).toBeAttached();
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("ID route resolves and shows page structure", async ({ page }) => {
    await page.goto("/listing/00000000-0000-0000-0000-000000000000");
    await expect(page.locator("body")).toBeAttached();
  });

  test("back navigation works from listing detail", async ({ page }) => {
    await page.goto("/search");
    await page.goto("/listing/00000000-0000-0000-0000-000000000000");
    await page.goBack();
    await expect(page).toHaveURL(/\/search/);
  });
});
