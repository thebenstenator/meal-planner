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

test('scales recipe amounts and sets a planned-meal serving override', async ({ page }) => {
  await signUp(page, uniqueEmail('scale'));
  const iso = todayISO();

  // A recipe with a scalable ingredient (default 4 servings).
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Scale Recipe');
  await page.getByLabel('Paste ingredients').fill('2 cups flour');
  await page.getByRole('button', { name: 'Parse & add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Scale Recipe' })).toBeVisible();

  // Scale up one serving (4 -> 5): 2 cups * 5/4 = 2.5.
  await expect(page.getByTestId('scale-servings')).toContainText('4 serv');
  await page.getByRole('button', { name: 'More servings' }).click();
  await expect(page.getByTestId('scale-servings')).toContainText('5 serv');
  await expect(page.getByText(/→ 2\.5 cup/)).toBeVisible();

  // Plan it with a serving override of 6.
  await page.goto('/planner');
  await page.getByRole('button', { name: `Add to dinner on ${iso}` }).click({ force: true });
  const panel = page.getByTestId('add-entry-panel');
  await panel.getByLabel('Servings for this meal').fill('6');
  await panel.getByLabel('Search recipes to add').fill('Scale Recipe');
  await panel.getByRole('button', { name: 'Scale Recipe' }).click();
  await expect(page.getByText('6sv')).toBeVisible();
});
