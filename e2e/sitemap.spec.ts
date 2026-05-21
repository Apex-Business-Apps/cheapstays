import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

test.describe("Sitemap and SEO", () => {
  test("public/sitemap.xml exists and is valid XML", async () => {
    const sitemapPath = join(process.cwd(), "public", "sitemap.xml");
    const content = readFileSync(sitemapPath, "utf-8");
    expect(content).toContain('<?xml version="1.0"');
    expect(content).toContain("<urlset");
    expect(content).toContain("https://cheapstays.me/");
    expect(content).toContain("https://cheapstays.me/search");
  });

  test("public/robots.txt exists and references sitemap", async () => {
    const robotsPath = join(process.cwd(), "public", "robots.txt");
    const content = readFileSync(robotsPath, "utf-8");
    expect(content).toContain("User-agent:");
    expect(content).toContain("sitemap.xml");
  });

  test("index.html has SEO meta tags", async () => {
    const indexPath = join(process.cwd(), "index.html");
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("robots");
    expect(content).toContain("sitemap");
  });

  test("/ page has correct title", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/CheapStays|cheapstays/i);
  });

  test("/search page has descriptive title", async ({ page }) => {
    await page.goto("/search");
    const title = await page.title();
    expect(title).toMatch(/Find|Search|Stay/i);
  });
});
