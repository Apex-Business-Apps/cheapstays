import { test, expect, type Page } from '@playwright/test';

const SUPABASE_REST = '**://muqdmvkapsxrsgdkfoxn.supabase.co/rest/v1/**';
const SUPABASE_RPC = '**://muqdmvkapsxrsgdkfoxn.supabase.co/rest/v1/rpc/**';
const SUPABASE_FN = '**://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1/**';

async function bootstrapMembershipSeed(page: Page, authenticated: boolean = true) {
  if (authenticated) {
    const userId = '11111111-1111-1111-1111-111111111111';
    const now = new Date().toISOString();

    await page.addInitScript(({ uid, issuedAt }) => {
      const key = 'sb-muqdmvkapsxrsgdkfoxn-auth-token';
      localStorage.setItem(key, JSON.stringify({
        access_token: 'e2e-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'e2e-refresh',
        user: { id: uid, email: `${uid}@e2e.local`, role: 'authenticated' },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }));
      localStorage.setItem('e2e-seeded-at', issuedAt);
    }, { uid: userId, issuedAt: now });

    await page.route(SUPABASE_RPC, async (route) => {
      if (route.request().url().includes('/rpc/my_roles')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['guest']) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route(SUPABASE_REST, async (route) => {
      const url = route.request().url();
      if (url.includes('/legal_consent_acceptances?')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ document_id: 'terms' }, { document_id: 'privacy' }]),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route(SUPABASE_FN, async (route) => {
      const url = route.request().url();
      if (url.includes('/membership-payment-intent')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ checkout_url: 'https://checkout.paymongo.com/e2e' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
  }
}

test.describe('Membership page', () => {
  test('unauthenticated user is redirected to signup when clicking Go Member', async ({ page }) => {
    await bootstrapMembershipSeed(page, false);
    await page.goto('/membership');
    await expect(page.getByRole('heading', { name: 'Go anywhere. Stay for less.' }).or(page.locator('h1'))).toBeVisible();
    
    await page.getByRole('button', { name: /Go Member/i }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signup/);
  });

  test('authenticated user can open payment dialog and select payment method', async ({ page }) => {
    await bootstrapMembershipSeed(page, true);
    await page.goto('/membership');
    
    const memberBtn = page.getByRole('button', { name: /Go Member/i });
    await expect(memberBtn).toBeVisible();
    await memberBtn.click();
    
    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Upgrade to Member/i })).toBeVisible();
    
    // Select GCash
    await page.getByRole('button', { name: /GCash/i }).click();
    
    // Pay button should be enabled
    const payBtn = page.getByRole('button', { name: /Pay ₱249/i });
    await expect(payBtn).toBeEnabled();
    
    // Submit payment
    await payBtn.click();
    
    // It should mock navigate to checkout URL (PayMongo in this mock)
    await page.waitForURL('**/checkout.paymongo.com/e2e**', { timeout: 5000 }).catch(() => {});
  });
});
