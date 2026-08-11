import { expect, test, type Page } from '@playwright/test';
import { generateList, openAddEntry } from './helpers';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function signUp(page: Page, email: string, password = 'password123') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app/);
}

test('check off an item offline, then sync on reconnect', async ({ page, context }) => {
  await signUp(page, uniqueEmail('offline'));
  const iso = todayISO();

  // A recipe → planned → generated list with a cream cheese item.
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Dip');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Dip' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Dip');
  await panel.getByRole('button', { name: 'Dip' }).click();

  await page.goto('/shopping-list');
  await generateList(page);
  const checkbox = page.getByRole('checkbox', { name: 'Check off cream cheese' });
  await expect(checkbox).toBeVisible();

  // Go offline and check it off — the write is queued optimistically.
  await context.setOffline(true);
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(page.getByTestId('sync-status')).toContainText('Offline');

  // Back online: the queued mutation replays and the status clears.
  await context.setOffline(false);
  await expect(page.getByTestId('sync-status')).toHaveCount(0, { timeout: 15000 });

  // Reload from the server — the check-off persisted.
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Check off cream cheese' })).toBeChecked();
});
