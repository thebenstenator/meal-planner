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

async function createRecipe(page: Page, title: string, ingredientLine: string) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(ingredientLine);
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function planRecipe(page: Page, iso: string, slot: string, title: string) {
  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to ${slot} on ${iso}`);
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
  await generateList(page);

  // 8 oz + 4 oz => 12 oz => buy 2 x 8 oz.
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await expect(page.getByText('12 oz')).toBeVisible();
  await expect(page.getByText(/buy 2 × 8 oz/)).toBeVisible();

  // Provenance: two recipes contributed.
  await page.getByRole('button', { name: /why\?/ }).first().click();
  await expect(page.getByText(/Cheese Dip A/)).toBeVisible();
  await expect(page.getByText(/Cheese Dip B/)).toBeVisible();

  // A manually added item survives regeneration.
  const addBox = page.getByPlaceholder('Add an item (e.g. paper towels)');
  await addBox.fill('paper towels');
  await addBox.press('Enter');
  // exact: the item row is "paper towels"; the success line "Added paper towels." would also match.
  await expect(page.getByText('paper towels', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.getByText('paper towels', { exact: true })).toBeVisible();
  // The consolidated line is still correct after regenerating.
  await expect(page.getByText('12 oz')).toBeVisible();
});

// The standing "running list": jot items anytime with no plan; items are
// smart-matched and deduped, and the list persists.
test('running list captures ad-hoc items, deduped', async ({ page }) => {
  await signUp(page, uniqueEmail('running'));
  await page.goto('/shopping-list');

  // Quick-add from the index — no meal plan or generated list needed.
  const box = page.getByPlaceholder('Add something you need…');
  await box.fill('dish soap');
  await box.press('Enter');
  await expect(page.getByText(/Added dish soap/)).toBeVisible();

  // Adding the same thing again is recognized, not duplicated.
  const box2 = page.getByPlaceholder('Add something you need…');
  await box2.fill('dish soap');
  await box2.press('Enter');
  await expect(page.getByText(/already on your list/)).toBeVisible();

  // The item shows inline on the list page, held once (one checkable row).
  await expect(page.getByRole('checkbox', { name: /check off dish soap/i })).toBeVisible();
  await expect(page.getByText(/dish soap/i).first()).toBeVisible();
});
