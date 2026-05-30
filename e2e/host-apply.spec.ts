import { test, expect, type Page } from '@playwright/test';

const SUPABASE_REST = '**://muqdmvkapsxrsgdkfoxn.supabase.co/rest/v1/**';
const SUPABASE_RPC = '**://muqdmvkapsxrsgdkfoxn.supabase.co/rest/v1/rpc/**';
const SUPABASE_STORAGE = '**://muqdmvkapsxrsgdkfoxn.supabase.co/storage/v1/**';

async function bootstrapHostApplySeed(page: Page, role: 'guest' | 'host' = 'guest', applicationSubmitted: boolean = false) {
  const userId = '33333333-3333-3333-3333-333333333333';
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([role]) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(SUPABASE_REST, async (route) => {
    const url = route.request().url();
    if (url.includes('/user_roles?')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ role }]) });
      return;
    }
    if (url.includes('/legal_consent_acceptances?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ document_id: 'terms' }, { document_id: 'privacy' }]),
      });
      return;
    }
    if (url.includes('/host_applications')) {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{}]) });
        return;
      }
      if (applicationSubmitted) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'app-1', status: 'pending' }]) });
        return;
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(SUPABASE_STORAGE, async (route) => {
    // Mock file uploads
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'test-key' }) });
      return;
    }
  });
}

test.describe('Host Apply flow', () => {
  test('redirects to host dashboard if already a host', async ({ page }) => {
    await bootstrapHostApplySeed(page, 'host');
    await page.goto('/host/apply');
    await expect(page.getByRole('heading', { name: "You're already a host" })).toBeVisible();
    await expect(page.getByRole('link', { name: "Go to Host tools" })).toBeVisible();
  });

  test('completes application flow successfully', async ({ page }) => {
    await bootstrapHostApplySeed(page, 'guest', false);
    await page.goto('/host/apply');
    
    // Step 1: Contact details
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByLabel('Full legal name *').fill('Juan dela Cruz');
    await page.getByLabel('Contact number *').fill('09171234567');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Property
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByLabel('City *').fill('Cebu City');
    await page.getByLabel('Province / Region *').fill('Cebu');
    await page.getByLabel('Describe your property *').fill('A beautiful 2-bedroom condo in the heart of Cebu City.');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Identity verification
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    
    // We cannot easily test file upload via UI interaction in this exact setup without a real file.
    // We'll simulate file uploads by using setInputFiles on the hidden file inputs.
    
    // Create a dummy file buffer
    const dummyBuffer = Buffer.from('dummy image content');
    
    const idInput = page.locator('input[type="file"]').first();
    await idInput.setInputFiles({ name: 'id.jpg', mimeType: 'image/jpeg', buffer: dummyBuffer });
    
    // Wait for upload checkmark
    await expect(page.getByText('id.jpg')).toBeVisible();
    
    const selfieInput = page.locator('input[type="file"]').nth(1);
    await selfieInput.setInputFiles({ name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: dummyBuffer });
    
    // Wait for upload checkmark
    await expect(page.getByText('selfie.jpg')).toBeVisible();
    
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Review & submit
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByText(/I agree to the/i).first().click();
    await page.getByText(/I consent to CheapStays/i).first().click();
    
    await page.getByRole('button', { name: 'Submit application' }).click();
    
    // Success state
    await expect(page.getByRole('heading', { name: 'Application submitted!' })).toBeVisible();
  });
});
