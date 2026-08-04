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

async function createRecipe(page: Page, title: string, ingredientLine: string) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(ingredientLine);
  await page.getByRole('button', { name: 'Parse & add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function planRecipe(page: Page, iso: string, slot: string, title: string) {
  await page.goto('/planner');
  await page.getByRole('button', { name: `Add to ${slot} on ${iso}` }).click({ force: true });
  const panel = page.getByTestId('add-entry-panel');
  await panel.getByLabel('Search recipes to add').fill(title);
  await panel.getByRole('button', { name: title }).click();
  await expect(page.getByText(title).first()).toBeVisible();
}

test('generates one consolidated, rounded line from two recipes', async ({ page }) => {
  await signUp(page, uniqueEmail('shopper'));
  const iso = todayISO();

  await createRecipe(page, 'Cheese Dip A', '8 oz cream cheese');
  await createRecipe(page, 'Cheese Dip B', '4 oz cream cheese');

  await planRecipe(page, iso, 'dinner', 'Cheese Dip A');
  await planRecipe(page, iso, 'lunch', 'Cheese Dip B');

  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Generate consolidated list' }).click({ force: true });

  // 8 oz + 4 oz => 12 oz => buy 2 x 8 oz.
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await expect(page.getByText('12 oz')).toBeVisible();
  await expect(page.getByText(/buy 2 × 8 oz/)).toBeVisible();

  // Provenance: two recipes contributed.
  await page.getByRole('button', { name: /why\?/ }).first().click();
  await expect(page.getByText(/Cheese Dip A/)).toBeVisible();
  await expect(page.getByText(/Cheese Dip B/)).toBeVisible();

  // A manually added item survives regeneration.
  await page.getByLabel('Add item name').fill('paper towels');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('paper towels')).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.getByText('paper towels')).toBeVisible();
  // The consolidated line is still correct after regenerating.
  await expect(page.getByText('12 oz')).toBeVisible();
});
