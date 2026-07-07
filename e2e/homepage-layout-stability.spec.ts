import { test, expect } from "@playwright/test";

/**
 * Regression guard for the landing-page layout-shift incident.
 *
 * Root cause: `scroll-snap-type: y mandatory` on <body> (snap-landing-active)
 * disabled browser scroll anchoring, so when the async homepage sections
 * resolved (skeleton → data) all content below jumped with no compensation,
 * and every panel was stretched to ~100svh leaving huge blank bands.
 */

declare global {
  interface Window {
    __cls: number;
  }
}

test.describe("Homepage — layout stability", () => {
  test("renders all core sections in natural flow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const heading of [
      "Where travelers are booking now",
      "Promoted & top-rated stays",
      "Need just a few hours?",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeAttached();
    }
  });

  test("document is not a scroll-snap container", async ({ page }) => {
    await page.goto("/");
    const snap = await page.evaluate(() => ({
      body: getComputedStyle(document.body).scrollSnapType,
      html: getComputedStyle(document.documentElement).scrollSnapType,
      bodyClass: document.body.className,
    }));
    expect(snap.body).toBe("none");
    expect(snap.html).toBe("none");
    expect(snap.bodyClass).not.toContain("snap-landing-active");
  });

  test("cumulative layout shift stays within budget after data loads", async ({ page }) => {
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntry[]) {
          const shift = entry as unknown as { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) window.__cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/", { waitUntil: "networkidle" });
    // Allow async sections (popular cities / featured / quick stays) to settle.
    await page.waitForTimeout(3000);
    const cls = await page.evaluate(() => window.__cls);
    expect(cls).toBeLessThan(0.1);
  });

  test("late content growth above the fold does not yank the viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // Scroll into the second section, then simulate late-resolving content
    // above it. With scroll anchoring active (no snap container), the reader's
    // position must be preserved.
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => {
      const h2 = document.querySelector("h2");
      const first = document.querySelector("main > div > *:not(script)");
      const filler = document.createElement("div");
      filler.style.height = "400px";
      first?.appendChild(filler);
      return h2 ? h2.getBoundingClientRect().top : 0;
    });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const h2 = document.querySelector("h2");
      return h2 ? h2.getBoundingClientRect().top : 0;
    });
    // Scroll anchoring should keep the visible content within a small tolerance.
    expect(Math.abs(after - before)).toBeLessThan(24);
  });
});
