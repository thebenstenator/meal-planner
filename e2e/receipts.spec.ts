import { expect, test, type Page } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string, password = 'password123') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app/);
}

// A 1x1 transparent PNG — enough for fileToImage to produce a data URL.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

// The parse-receipt vision call is non-deterministic, so we stub it and exercise
// the real client flow: matching, the review form, saving a trip, and the trip
// showing up as actual spend. CORS preflight is answered too (cross-origin fn).
const CANNED_RECEIPT = {
  receipt: {
    store_name: 'Test Mart',
    purchased_on: null,
    total_cents: 1234,
    line_items: [
      { description: 'eggs', quantity: 1, unit: 'dozen', total_price_cents: 399, unit_price_cents: 399 },
      { description: 'milk', quantity: 1, unit: 'gal', total_price_cents: 835, unit_price_cents: 835 },
    ],
  },
};

test('scan a receipt (stubbed), save the trip, and see it as spend', async ({ page }) => {
  await signUp(page, uniqueEmail('receipt'));

  await page.route('**/functions/v1/parse-receipt', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'content-type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers, body: 'ok' });
      return;
    }
    await route.fulfill({ status: 200, headers, body: JSON.stringify(CANNED_RECEIPT) });
  });

  await page.goto('/receipts');
  await expect(page.getByRole('heading', { name: 'Scan a receipt' })).toBeVisible();

  // Attach a photo via the real file-chooser (hidden input).
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText(/Add receipt photos/).click(),
  ]);
  await chooser.setFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG_1X1 });

  await page.getByRole('button', { name: 'Scan receipt' }).click();

  // Review step: parsed store, lines, and prefilled total.
  await expect(page.getByRole('button', { name: 'Save trip' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Read from/)).toContainText('Test Mart');
  await expect(page.getByText('eggs')).toBeVisible();
  await expect(page.getByLabel('Total ($)')).toHaveValue('12.34');

  await page.getByRole('button', { name: 'Save trip' }).click();

  // Confirmation + trip log (total shown; no store linked so just the date row).
  await expect(page.getByText(/Trip saved with 2 items/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('$12.34')).toBeVisible();

  // Shows up as actual spend on the spending page.
  await page.goto('/spending');
  await expect(page.getByText('$12.34').first()).toBeVisible({ timeout: 15000 });
});
