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

// A recipe that uses exactly one 8 oz package of cream cheese, priced at $2.50,
// should show a consumption cost of $2.50 (and the shopping list, buying one
// whole package, agrees here because the need is exactly one package).
test('shows a consumption-based recipe cost from a captured price', async ({ page }) => {
  await signUp(page, uniqueEmail('recipecost'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Cost Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Cost Test' })).toBeVisible();

  // Plan it so cream cheese lands on a shopping list we can price.
  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Cost Test');
  await panel.getByRole('button', { name: 'Cost Test' }).click();

  // Default store.
  await page.goto('/stores');
  await page.getByLabel('New store name').fill('Test Store');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Set default' }).click();

  // Generate the list and price cream cheese: $2.50 / 8 oz.
  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await page.getByRole('button', { name: 'set an estimate price' }).click();
  await page.getByLabel('Package price').fill('2.50');
  await page.getByLabel('Package quantity').fill('8');
  await page.getByLabel('Package unit').fill('oz');
  await page.getByRole('button', { name: 'Save price' }).click();
  await expect(page.getByTestId('projected-total')).toContainText('$2.50');

  // The recipe now shows its consumption cost.
  await page.goto('/recipes');
  await page.getByRole('link', { name: /Cost Test/ }).click();
  await expect(page.getByTestId('recipe-cost')).toContainText('$2.50');
});

// A manually set meal price overrides the ingredient-derived cost, and clearing
// it falls back to the calculation.
test('a manual meal price wins over the ingredient cost', async ({ page }) => {
  await signUp(page, uniqueEmail('mealprice'));

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Flat Price');
  await page.getByLabel('Paste ingredients').fill('1 mystery item');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Flat Price' })).toBeVisible();

  // No store/prices yet: the cost card offers to set a flat price.
  await page.getByRole('button', { name: 'set a price' }).click();
  await page.getByLabel('Meal price').fill('12.00');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('recipe-cost')).toContainText('$12.00');
  await expect(page.getByText(/Set manually/)).toBeVisible();

  // Clearing it returns to the "no prices" prompt.
  await page.getByRole('button', { name: 'Edit price' }).click();
  await page.getByRole('button', { name: 'Use ingredient cost' }).click();
  await expect(page.getByTestId('recipe-cost')).toHaveCount(0);
});
