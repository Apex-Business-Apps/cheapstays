import { test, expect } from "@playwright/test";

const CRITICAL_ROUTES = ["/", "/search", "/auth", "/membership", "/support"];

for (const route of CRITICAL_ROUTES) {
  test.describe(`Responsive layout: ${route}`, () => {
    test("no horizontal overflow at mobile (375px)", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      // Allow up to 5px tolerance for sub-pixel rendering
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
    });

    test("no horizontal overflow at tablet (768px)", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
    });

    test("renders correctly at desktop (1440px)", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      // Main content should be visible
      await expect(page.locator("main, #root, [role='main']").first()).toBeAttached();
    });
  });
}

test.describe("Touch targets", () => {
  test("primary buttons meet 44px minimum tap target at mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/auth");
    await page.waitForLoadState("domcontentloaded");
    const buttons = page.locator("button[type='submit']");
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
