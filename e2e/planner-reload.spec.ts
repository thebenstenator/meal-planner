import { expect, test, type Page } from '@playwright/test';
import { openAddEntry } from './helpers';

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

// The planner costs recipes via a query whose data must be JSON-serializable —
// a Map would round-trip to {} in the persisted cache and crash on reload
// (n.forEach is not a function). Reloading with a planned meal must not crash.
test('planner survives a reload with a persisted cost cache', async ({ page }) => {
  test.slow(); // deliberately waits for the cache to persist, then reloads.
  await signUp(page, uniqueEmail('reload'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Reload Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Reload Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Reload Test');
  await panel.getByRole('button', { name: 'Reload Test' }).click();
  // Wait for the panel to close before matching by text: until it does, its
  // search-result button still reads "Reload Test" and a bare text match hits
  // both that and the new entry chip (strict-mode violation, not a race).
  await expect(page.getByTestId('add-entry-panel')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText('Reload Test')).toBeVisible();

  // Let the cache persist, then reload → it rehydrates from localStorage.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.reload();

  // Previously crashed here in a useMemo; now the planner renders fine.
  await expect(page.getByText('Reload Test')).toBeVisible();
});
