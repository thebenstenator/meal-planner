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
 * Add the first item, which starts the household's first list. `name` must be
 * one no canonical ingredient matches, so the row is labelled as typed.
 */
async function startList(page: Page, name: string) {
  const box = page.getByPlaceholder('Add something you need…');
  await box.fill(name);
  await box.press('Enter');
  await expect(page.getByRole('checkbox', { name: `Check off ${name}` })).toBeVisible();
}

/**
 * Jot another item onto the open list. Waits on the status line rather than the
 * row: a typed name that matches a known ingredient is displayed under that
 * ingredient's name ("bananas" → "banana").
 */
async function jot(page: Page, name: string) {
  const box = page.getByPlaceholder('Add something you need…');
  await box.fill(name);
  await box.press('Enter');
  await expect(page.getByRole('status')).toContainText(`Added ${name}.`);
}

// Items land in a deduced store section; anything unrecognizable goes to Other.
test('added items are filed into store categories', async ({ page }) => {
  await signUp(page, uniqueEmail('categories'));
  await page.goto('/shopping-list');

  await startList(page, 'paper towels');
  await jot(page, 'bananas');
  await jot(page, 'zzzql');

  await expect(page.getByRole('heading', { name: 'Household' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Produce' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Other' })).toBeVisible();
});

// The shopper has the last word: move an item to another section, and make a
// section of their own when none of the defaults fit.
test('an item can be recategorized, into a category you create', async ({ page }) => {
  await signUp(page, uniqueEmail('recategorize'));
  await page.goto('/shopping-list');
  await startList(page, 'paper towels');

  await page.getByRole('link', { name: 'open full list →' }).click();
  await expect(page.getByRole('heading', { name: 'Household' })).toBeVisible();

  // Move it to an existing section.
  await page.getByRole('button', { name: 'edit' }).first().click();
  await page.getByLabel('Category for paper towels').selectOption('snacks');
  await expect(page.getByRole('heading', { name: 'Snacks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Household' })).toHaveCount(0);

  // …or into one that doesn't exist yet.
  await page.getByRole('button', { name: 'edit' }).first().click();
  await page.getByLabel('Category for paper towels').selectOption('__new__');
  const newCategory = page.getByLabel('New category for paper towels');
  await newCategory.fill('Bulk bins');
  await newCategory.press('Enter');
  await expect(page.getByRole('heading', { name: 'Bulk bins' })).toBeVisible();

  // The choice sticks for the ingredient: it survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bulk bins' })).toBeVisible();
});

// Categories are the household's own: rename them, reorder them, delete the
// ones they don't use (their items fall back to Other, they never vanish).
test('categories can be renamed, reordered and deleted', async ({ page }) => {
  await signUp(page, uniqueEmail('managecats'));
  await page.goto('/shopping-list');
  await startList(page, 'paper towels');

  await page.getByRole('link', { name: 'open full list →' }).click();
  await page.getByRole('button', { name: 'Categories' }).click();
  const manager = page.getByRole('region', { name: 'Shopping categories' });
  const householdRow = manager.getByRole('listitem').filter({ hasText: 'Household' });

  // Rename: the section header follows.
  await householdRow.getByRole('button', { name: 'rename' }).click();
  await manager.getByLabel('Rename Household').fill('Cleaning');
  await manager.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning' })).toBeVisible();

  // Reorder: Bakery moves above Produce.
  await manager.getByRole('button', { name: 'Move Bakery up' }).click();
  await expect(manager.getByRole('listitem').first()).toContainText('Bakery');

  // Delete: the item lands in Other rather than disappearing.
  const cleaningRow = manager.getByRole('listitem').filter({ hasText: 'Cleaning' });
  await cleaningRow.getByRole('button', { name: 'delete', exact: true }).click();
  await manager.getByRole('button', { name: 'delete, move items to Other' }).click();
  await expect(page.getByRole('heading', { name: 'Other' })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Check off paper towels' }),
  ).toBeVisible();
});
