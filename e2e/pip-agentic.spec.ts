/**
 * E2E — Pip agentic features
 *
 * Validates the end-to-end agentic Pip flows:
 *  1. Chat panel opens and shows greeting
 *  2. Quick-prompt chips are present and clickable
 *  3. Search intent triggers ai-search (listing cards appear or fallback text)
 *  4. "Book this" button transitions to booking form panel
 *  5. Booking panel shows date inputs, guest controls, and price breakdown
 *  6. Cancel returns to chat
 *  7. "Search for X" command navigates to /search?q=X
 *
 * Tests mock the Supabase edge functions via page.route() interception.
 */

import { test, expect, type Page } from "@playwright/test";

const MOCK_LISTINGS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "palawan-villa-1",
    title: "Beachfront Villa El Nido",
    city: "El Nido",
    province: "Palawan",
    bedrooms: 2,
    bathrooms: 1,
    max_guests: 4,
    nightly_php: 2500,
    min_nights: 2,
    amenities: ["wifi", "pool", "aircon"],
    images: [],
    is_owner_direct: true,
    instant_book: true,
    avg_rating: 4.8,
    review_count: 23,
    why_its_a_deal: "Owner-direct pricing — no platform markup.",
    score: 92,
  },
];

async function mockAiSearch(page: Page) {
  await page.route("**/functions/v1/ai-search", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: "Found 1 great option in Palawan!", results: MOCK_LISTINGS }),
    });
  });
}

async function mockAiChat(page: Page) {
  await page.route("**/functions/v1/ai-chat", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: "Hello! I can help you find a great stay in the Philippines.",
    });
  });
}

async function openPip(page: Page) {
  // FAB is the Sparkles button (fixed bottom-right)
  const fab = page.locator("button.rounded-full.bg-primary").last();
  await fab.click();
  await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 6000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Pip agentic — chat panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockAiChat(page);
    await page.goto("/");
  });

  test("FAB opens chat panel with greeting", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();
    // The header <p> "Pip" (strict: use first() to avoid matching greeting text)
    await expect(dialog.locator("p.text-sm.font-medium").filter({ hasText: "Pip" })).toBeVisible();
  });

  test("quick-prompt chips are visible and labelled", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    // Quick prompts rendered in English by default (pip.q1 = "Palawan under ₱3k")
    const chip = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await expect(chip).toBeVisible({ timeout: 5000 });
  });

  test("mute button is visible and toggleable", async ({ page }) => {
    await openPip(page);
    const dialog  = page.locator("[role='dialog']");
    // Mute button has aria-label = t("pip.mute") = "Mute voice" in English
    const muteBtn = dialog.locator("button[aria-label='Mute voice']");
    await expect(muteBtn).toBeVisible({ timeout: 5000 });
    await muteBtn.click();
    // After click, the button switches to "Enable voice" (pip.unmute)
    await expect(dialog.locator("button[aria-label='Enable voice']")).toBeVisible({ timeout: 3000 });
    // Click again to restore
    await dialog.locator("button[aria-label='Enable voice']").click();
    await expect(dialog.locator("button[aria-label='Mute voice']")).toBeVisible({ timeout: 3000 });
  });

  test("close button dismisses the panel", async ({ page }) => {
    await openPip(page);
    const dialog   = page.locator("[role='dialog']");
    // Close button has aria-label = t("pip.close") = "Close chat" in English
    const closeBtn = dialog.locator("button[aria-label='Close chat']");
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Pip agentic — search results", () => {
  test.beforeEach(async ({ page }) => {
    await mockAiSearch(page);
    await mockAiChat(page);
    await page.goto("/");
  });

  test("search intent query shows listing cards", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const input  = dialog.locator("input[placeholder]");
    // "villa Palawan" matches SEARCH_INTENT_RE (villa) without triggering navigation
    await input.fill("villa Palawan cheap");
    await input.press("Enter");
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });
  });

  test("quick-prompt chip triggers search results", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    // ai-search mock returns the listing
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });
  });

  test("listing card shows View and Book buttons", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const input  = dialog.locator("input[placeholder]");
    await input.fill("villa Palawan cheap");
    await input.press("Enter");
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });

    // View button (t("pip.viewListing") = "View" in English)
    const viewBtn = dialog.locator("button").filter({ hasText: "View" }).first();
    await expect(viewBtn).toBeVisible({ timeout: 5000 });

    // Book button (t("pip.bookThis") = "Book this" in English)
    const bookBtn = dialog.locator("button").filter({ hasText: "Book this" }).first();
    await expect(bookBtn).toBeVisible({ timeout: 5000 });
  });

  test("listing card renders without deprecated booking badges", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });
    // Price per night must render
    await expect(dialog.locator("text=/₱2[,.]?500/")).toBeVisible({ timeout: 5000 });
    // Instant Book is no longer a per-listing badge — must not appear inside the card/dialog
    await expect(dialog.locator("text=Instant Book")).not.toBeVisible();
    // Owner Direct is platform-level brand only — must not appear as a listing-level badge
    await expect(dialog.locator("text=Owner Direct")).not.toBeVisible();
  });

  test("Pip search results do not show deprecated per-listing flow labels", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const input  = dialog.locator("input[placeholder]");
    await input.fill("villa Palawan cheap");
    await input.press("Enter");
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });
    // No listing card may present Owner Direct as a listing-specific booking mode
    await expect(dialog.locator("text=Owner Direct")).not.toBeVisible();
    // No listing card may present Instant Book as a member-only or per-listing feature
    await expect(dialog.locator("text=Instant Book")).not.toBeVisible();
  });

  test("listing card shows price per night", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });
    // t("pip.perNight", { price: "2,500" }) = "₱2,500/night" in English
    await expect(dialog.locator("text=/₱2[,.]?500/")).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Pip agentic — booking flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAiSearch(page);
    await mockAiChat(page);
    await page.goto("/");
  });

  test("Book button opens booking panel with date inputs", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });

    const bookBtn = dialog.locator("button").filter({ hasText: "Book this" }).first();
    await bookBtn.click();

    // Booking panel should slide in with two date inputs
    await expect(dialog.locator("input[type='date']").first()).toBeVisible({ timeout: 6000 });
    await expect(dialog.locator("input[type='date']").nth(1)).toBeVisible({ timeout: 3000 });
  });

  test("booking panel shows listing title and confirm button", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });

    const bookBtn = dialog.locator("button").filter({ hasText: "Book this" }).first();
    await bookBtn.click();
    await expect(dialog.locator("input[type='date']").first()).toBeVisible({ timeout: 6000 });

    // Listing title in booking panel header
    await expect(dialog.locator("text=Beachfront Villa El Nido").last()).toBeVisible({ timeout: 3000 });

    // Confirm button (t("pip.confirmBtn") = "Confirm")
    await expect(dialog.locator("button").filter({ hasText: "Confirm" }).last()).toBeVisible({ timeout: 3000 });
  });

  test("Cancel button in booking panel returns to chat", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });

    const bookBtn = dialog.locator("button").filter({ hasText: "Book this" }).first();
    await bookBtn.click();
    await expect(dialog.locator("input[type='date']").first()).toBeVisible({ timeout: 6000 });

    // Cancel button has aria-label = t("pip.cancelBtn") = "Cancel" and text "Cancel"
    const cancelBtn = dialog.locator("button").filter({ hasText: "Cancel" }).first();
    await cancelBtn.click();

    // Booking panel animates out (~300ms); date inputs must disappear
    await expect(dialog.locator("input[type='date']").first()).not.toBeVisible({ timeout: 5000 });
    // Chat input must be restored
    await expect(dialog.locator("input[placeholder]")).toBeVisible({ timeout: 3000 });
  });

  test("booking panel shows price breakdown after valid dates", async ({ page }) => {
    await openPip(page);
    const dialog = page.locator("[role='dialog']");
    const chip   = dialog.locator("button").filter({ hasText: /palawan/i }).first();
    await chip.click();
    await expect(dialog.locator("text=Beachfront Villa El Nido")).toBeVisible({ timeout: 12000 });

    const bookBtn = dialog.locator("button").filter({ hasText: "Book this" }).first();
    await bookBtn.click();
    await expect(dialog.locator("input[type='date']").first()).toBeVisible({ timeout: 6000 });

    // Price breakdown should be visible (min_nights=2, default dates satisfy constraint)
    await expect(dialog.locator("text=/₱[0-9]/").first()).toBeVisible({ timeout: 5000 });
    // Summary label (t("pip.bookingSummary") = "Booking Summary")
    await expect(dialog.locator("text=Booking Summary")).toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Pip agentic — search page control", () => {
  test("'Search for X' command navigates to /search with query param", async ({ page }) => {
    await mockAiSearch(page);
    await mockAiChat(page);
    await page.goto("/");
    await openPip(page);

    const dialog = page.locator("[role='dialog']");
    const input  = dialog.locator("input[placeholder]");
    // Must use "search for X" prefix to trigger navigation (not "find X" which shows cards)
    await input.fill("search for El Nido beachfront villa");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=/, { timeout: 8000 });
  });
});
