import { test, expect } from "@playwright/test";

test.describe("stay-voucher public flow", () => {
  test("browse page renders", async ({ page }) => {
    await page.goto("/stay-vouchers");
    await expect(page.getByRole("heading", { name: /voucher deals/i })).toBeVisible();
  });

  test("detail page shows purchase form when a batch is seeded", async ({ page }) => {
    await page.goto("/stay-vouchers");
    const firstCard = page.getByRole("link", { name: /buy voucher|view details/i }).first();
    if (!(await firstCard.count())) test.skip(true, "no active batches seeded");
    await firstCard.click();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/i understand.*non-refundable/i)).toBeVisible();
    // Submit button is disabled until the checkbox is checked
    const btn = page.getByRole("button", { name: /buy voucher/i });
    await expect(btn).toBeDisabled();
  });

  test("success page requires purchase and token params", async ({ page }) => {
    await page.goto("/stay-vouchers/success");
    await expect(page.getByText(/missing purchase reference/i)).toBeVisible();
  });
});
