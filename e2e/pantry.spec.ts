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

// Checking a matched item off the shopping list adds it to the pantry.
test('buying a matched item adds it to the pantry', async ({ page }) => {
  await signUp(page, uniqueEmail('pantry'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Pantry Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Parse & add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Pantry Test' })).toBeVisible();

  await page.goto('/planner');
  await page.getByRole('button', { name: `Add to dinner on ${iso}` }).click({ force: true });
  const panel = page.getByTestId('add-entry-panel');
  await panel.getByLabel('Search recipes to add').fill('Pantry Test');
  await panel.getByRole('button', { name: 'Pantry Test' }).click();

  // Pantry starts empty.
  await page.goto('/pantry');
  await expect(page.getByText('Your pantry is empty')).toBeVisible();

  // Generate the list (auto-navigates to the list detail), then buy it.
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Generate consolidated list' }).click({ force: true });
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Check off cream cheese' }).click({ force: true });
  await page.waitForLoadState('networkidle');

  // Now it's in the pantry with the bought quantity.
  await page.goto('/pantry');
  await expect(page.getByText('cream cheese')).toBeVisible();
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveValue('8');
});
