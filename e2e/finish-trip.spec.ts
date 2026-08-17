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

/**
 * Jot an item onto the open list. Waits on the status line, not the row: smart
 * add displays a matched item under its canonical name ("bananas" → "banana"),
 * so the typed name isn't a reliable row locator.
 */
async function addItem(page: Page, name: string) {
  const box = page.getByPlaceholder('Add something you need…');
  await box.fill(name);
  await box.press('Enter');
  await expect(page.getByRole('status')).toContainText(`Added ${name}.`, { timeout: 15000 });
}

// The free closeout: check things off, log what you spent, clear the bought
// items and keep the rest. No receipt scan — that path is premium and the vision
// call is stubbed elsewhere (receipts.spec.ts).
test('closes out a trip: logs the total, then clears only what was bought', async ({ page }) => {
  test.slow();
  await signUp(page, uniqueEmail('closeout'));

  await page.goto('/shopping-list');
  await page.getByRole('button', { name: '+ New list' }).click();
  await page.getByLabel('New list name').fill('Corner Shop');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('heading', { name: 'Corner Shop' })).toBeVisible({ timeout: 15000 });

  // "paper towels" survives smart add unrenamed; the second item is only ever
  // counted, so whatever it's filed under doesn't matter.
  await addItem(page, 'paper towels');
  await addItem(page, 'bananas');
  await expect(page.getByRole('checkbox')).toHaveCount(2, { timeout: 15000 });

  // Nothing checked off yet, so the closeout stays out of the way.
  await expect(page.getByTestId('finish-trip')).toHaveCount(0);

  await page.getByRole('checkbox', { name: 'Check off paper towels' }).click({ force: true });
  await expect(page.getByTestId('finish-trip')).toBeVisible({ timeout: 15000 });

  await page.getByTestId('finish-trip').click();
  await expect(page.getByText('1 item checked off')).toBeVisible();

  // The total is deliberately blank — logging is blocked until it's filled in.
  const logTrip = page.getByRole('button', { name: 'Log trip' });
  await expect(logTrip).toBeDisabled();
  await page.getByLabel('Trip total').fill('7.42');
  await logTrip.click();

  await expect(page.getByText('Saved to your spending.')).toBeVisible({ timeout: 15000 });
  // exact, or this also matches the standalone "clear 1 checked" behind the dialog.
  await page.getByRole('button', { name: 'Clear 1', exact: true }).click();

  // The bought item is gone; the one still needed stays.
  await expect(page.getByRole('checkbox', { name: 'Check off paper towels' })).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.getByRole('checkbox')).toHaveCount(1);

  await page.goto('/spending');
  await expect(page.getByText('$7.42').first()).toBeVisible({ timeout: 15000 });
});
