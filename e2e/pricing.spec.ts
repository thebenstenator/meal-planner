import { expect, test, type Page } from '@playwright/test';

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

test('prices an item and shows a projected total', async ({ page }) => {
  await signUp(page, uniqueEmail('pricer'));
  const iso = todayISO();

  // Recipe with 12 oz cream cheese.
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Big Dip');
  await page.getByLabel('Paste ingredients').fill('12 oz cream cheese');
  await page.getByRole('button', { name: 'Parse & add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Big Dip' })).toBeVisible();

  // Plan it for today.
  await page.goto('/planner');
  await page.getByRole('button', { name: `Add to dinner on ${iso}` }).click({ force: true });
  const panel = page.getByTestId('add-entry-panel');
  await panel.getByLabel('Search recipes to add').fill('Big Dip');
  await panel.getByRole('button', { name: 'Big Dip' }).click();

  // Add a store and make it the default.
  await page.goto('/stores');
  await page.getByLabel('New store name').fill('Test Store');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Set default' }).click();

  // Generate the list.
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Generate consolidated list' }).click({ force: true });
  await expect(page.getByText('cream cheese').first()).toBeVisible();

  // Price it: $2.50 for an 8 oz package. Need 12 oz => buy 2 => $5.00.
  await page.getByRole('button', { name: 'no price yet — add one' }).click();
  await page.getByLabel('Package price').fill('2.50');
  await page.getByLabel('Package quantity').fill('8');
  await page.getByLabel('Package unit').fill('oz');
  await page.getByRole('button', { name: 'Save price' }).click();

  await expect(page.getByTestId('projected-total')).toContainText('$5.00');
});
