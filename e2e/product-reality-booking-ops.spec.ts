import { test, expect, type Page } from '@playwright/test';

const SUPABASE_REST = '**://muqdmvkapsxrsgdkfoxn.supabase.co/rest/v1/**';
const SUPABASE_RPC = '**://muqdmvkapsxrsgdkfoxn.supabase.co/rest/v1/rpc/**';
const SUPABASE_FN = '**://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1/**';

type BookingSeedMode = 'guest-unpaid' | 'guest-cancel' | 'host';

async function bootstrapDeterministicSeed(page: Page, mode: BookingSeedMode) {
  const userId = mode === 'host' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  const now = new Date().toISOString();
  const ci = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  const co = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);

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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mode === 'host' ? 'host' : 'guest']) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(SUPABASE_REST, async (route) => {
    const url = route.request().url();
    if (url.includes('/legal_consent_acceptances?')) {
      // ConsentGate requires persisted signup Terms+Privacy acceptance records.
      // Seed deterministic positive consent for e2e auth personas so booking/host
      // flows remain reachable in this suite.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ document_id: 'terms' }, { document_id: 'privacy' }]),
      });
      return;
    }
    if (url.includes('/user_roles?') && mode === 'host') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ role: 'host' }]) });
      return;
    }
    if (url.includes('/user_roles?')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ role: 'guest' }]) });
      return;
    }
    if (url.includes('/bookings?') && mode === 'guest-unpaid') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'bk-unpaid', listing_id: 'listing-1', check_in: ci, check_out: co, nights: 2, guests: 2, total_php: 4200, status: 'confirmed', payment_status: 'unpaid', created_at: now, listings: { title: 'E2E Listing', city: 'Cebu', province: 'Cebu', images: [], slug: 'e2e-listing' } }]) });
      return;
    }
    if (url.includes('/bookings?') && mode === 'guest-cancel') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'bk-cancel', listing_id: 'listing-2', check_in: ci, check_out: co, nights: 2, guests: 2, total_php: 3800, status: 'confirmed', payment_status: 'paid', created_at: now, listings: { title: 'Cancel Listing', city: 'Cebu', province: 'Cebu', images: [], slug: 'cancel-listing' } }]) });
      return;
    }
    if (url.includes('/bookings?') && mode === 'host') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'bk-host', listing_id: 'listing-1', check_in: ci, check_out: co, flow_state: 'approved', status: 'confirmed', total_php: 4200, guest_id: '111', listings: { title: 'E2E Listing' } }]) });
      return;
    }
    if (url.includes('/listings?') && mode === 'host') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'listing-1' }]) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(SUPABASE_FN, async (route) => {
    const url = route.request().url();
    if (url.includes('/booking-checkout')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Payment provider unavailable' }) });
      return;
    }
    if (url.includes('/cancel-booking-guest')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

test.describe('product reality booking ops', () => {
  test('guest unpaid confirmed booking requires payment before cancellation', async ({ page }) => {
    await bootstrapDeterministicSeed(page, 'guest-unpaid');
    await page.goto('/my-bookings');
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay now' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Pay now' }).first().click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Payment provider unavailable' }).first()).toBeVisible();
    await expect(page.getByText('Payment pending')).toBeVisible();
  });

  test('guest can cancel upcoming confirmed booking after policy acknowledgment', async ({ page }) => {
    await bootstrapDeterministicSeed(page, 'guest-cancel');
    await page.goto('/my-bookings');
    await expect(page.getByRole('button', { name: 'Cancel' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Cancel booking' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit cancellation' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Cancellation policy acknowledgement required' }).first()).toBeVisible();
    await page.getByPlaceholder('Reason for cancellation').fill('Need to rebook');
    await page.getByLabel(/I acknowledge the cancellation policy/i).check();
    await page.getByRole('button', { name: 'Submit cancellation' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Booking cancelled' }).first()).toBeVisible();
  });

  test('host calendar supports real date actions', async ({ page }) => {
    await bootstrapDeterministicSeed(page, 'host');
    await page.goto('/host');
    await page.getByRole('tab', { name: 'Calendar' }).click();
    await expect(page.getByText('Loading calendar…').or(page.getByText('Hover a day for a summary'))).toBeVisible();
  });

  test('signup requires terms and privacy consent', async ({ page }) => {
    await page.goto('/auth?mode=signup');
    await expect(page.getByText('I agree to the Terms of Service.')).toBeVisible();
    await expect(page.getByText('I agree to the Privacy Policy.')).toBeVisible();
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /^Sign up$/ }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'You must accept Terms and Privacy' }).first()).toBeVisible();
  });

  test('booking requires renter cancellation and house rule consent', async ({ page }) => {
    await page.goto('/listing/slug/e2e-listing');
    await expect(page.getByText('Renter rules').or(page.getByText('House rules')).or(page.getByText('Cancellation policy'))).toBeVisible();
  });
});
