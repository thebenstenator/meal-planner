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

// The AI classify call is non-deterministic, so we stub it and exercise the real
// wiring: an uncategorized pantry item is offered for auto-sort (premium), the
// call persists a category, and the page confirms.
test('AI auto-sorts uncategorized pantry items (stubbed)', async ({ page }) => {
  await signUp(page, uniqueEmail('classify'));

  await page.route('**/functions/v1/classify-ingredients', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'content-type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers, body: 'ok' });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({ items: [{ name: 'florbnak', category: 'other' }] }),
    });
  });

  // Bulk-add a made-up item → created with no category (guesser can't place it).
  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: /Bulk add from a list/ }).click();
  await page.getByLabel('Paste your inventory').fill('florbnak');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('button', { name: /Add 1 item/ }).click();
  await expect(page.getByText(/Added 1 item/)).toBeVisible();

  // On Ideas, the premium auto-sort shortcut appears; running it confirms.
  await page.goto('/suggest');
  const sortBtn = page.getByRole('button', { name: /Auto-sort 1 uncategorized item/ });
  await expect(sortBtn).toBeVisible({ timeout: 15000 });
  await sortBtn.click();
  await expect(page.getByText(/Sorted 1 item/)).toBeVisible({ timeout: 15000 });
});
