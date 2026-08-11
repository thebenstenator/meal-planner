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

// The single-item add form is "type and add": no dropdown click required. It
// resolves the typed name to an existing ingredient or creates one, and gives
// clear success / guidance feedback.
test('pantry add: type and add without picking, with clear feedback', async ({ page }) => {
  await signUp(page, uniqueEmail('addfeedback'));
  await page.goto('/pantry');

  // Tapping Add with an empty box explains what to do (no silent no-op).
  await page.getByRole('button', { name: 'Add', exact: true }).click({ force: true });
  await expect(page.getByText(/Type an ingredient to add/)).toBeVisible();

  // Type an existing ingredient and press Enter — no dropdown selection needed.
  const box = page.getByPlaceholder('Type an ingredient…');
  await box.fill('cream cheese');
  await box.press('Enter');
  await expect(page.getByText(/Added .*cream cheese.* to your pantry/i)).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'cream cheese' })).toBeVisible();

  // A made-up name is created on the fly and flagged as new.
  const box2 = page.getByPlaceholder('Type an ingredient…');
  await box2.fill('florbnak');
  await box2.press('Enter');
  await expect(page.getByText(/new ingredient/i)).toBeVisible();
});

// Checking a matched item off the shopping list adds it to the pantry.
test('buying a matched item adds it to the pantry', async ({ page }) => {
  await signUp(page, uniqueEmail('pantry'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Pantry Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Pantry Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Pantry Test');
  await panel.getByRole('button', { name: 'Pantry Test' }).click();

  // Pantry starts empty.
  await page.goto('/pantry');
  await expect(page.getByText('Your pantry is empty')).toBeVisible();

  // Generate the list (auto-navigates to the list detail), then buy it.
  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Check off cream cheese' }).click({ force: true });
  await page.waitForLoadState('networkidle');

  // Now it's in the pantry with the bought quantity.
  await page.goto('/pantry');
  await expect(page.getByText('cream cheese')).toBeVisible();
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveValue('8');
});

// Marking a planned meal cooked removes its ingredients from the pantry.
test('cooking a meal removes its ingredients from the pantry', async ({ page }) => {
  await signUp(page, uniqueEmail('cook'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Cook Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Cook Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Cook Test');
  await panel.getByRole('button', { name: 'Cook Test' }).click();

  // Stock the pantry with 16 oz cream cheese.
  await page.goto('/pantry');
  await page.getByPlaceholder('Type an ingredient…').fill('cream cheese');
  await page.getByRole('button', { name: /cream cheese/ }).first().click();
  await page.getByLabel('Quantity', { exact: true }).fill('16');
  await page.getByLabel('Unit', { exact: true }).fill('oz');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveValue('16');

  // Cook the meal → 8 oz leaves the pantry.
  await page.goto('/planner');
  await page.getByRole('button', { name: 'Mark cooked' }).click({ force: true });
  await page.waitForLoadState('networkidle');

  await page.goto('/pantry');
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveValue('8');
});

// A low pantry item is folded straight into a generated list.
test('folds a low pantry item into a generated list', async ({ page }) => {
  await signUp(page, uniqueEmail('lowstock'));

  // Stock a nearly-empty item: 0.5 oz cream cheese (pkg 8 oz => ~6% => low).
  await page.goto('/pantry');
  await page.getByPlaceholder('Type an ingredient…').fill('cream cheese');
  await page.getByRole('button', { name: /cream cheese/ }).first().click();
  await page.getByLabel('Quantity', { exact: true }).fill('0.5');
  await page.getByLabel('Unit', { exact: true }).fill('oz');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveValue('0.5');

  // Generate a list with no meal plan — the low pantry item is pulled in on its
  // own, so it's already a list item (not a separate "Running low" suggestion).
  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Running low' })).toBeHidden();
});

// Generating a list subtracts what's already in the pantry.
test('list generation subtracts pantry stock', async ({ page }) => {
  await signUp(page, uniqueEmail('offset'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Offset Test');
  await page.getByLabel('Paste ingredients').fill('12 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Offset Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Offset Test');
  await panel.getByRole('button', { name: 'Offset Test' }).click();

  // Already have 4 oz on hand.
  await page.goto('/pantry');
  await page.getByPlaceholder('Type an ingredient…').fill('cream cheese');
  await page.getByRole('button', { name: /cream cheese/ }).first().click();
  await page.getByLabel('Quantity', { exact: true }).fill('4');
  await page.getByLabel('Unit', { exact: true }).fill('oz');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveValue('4');

  // Generate with the pantry offset on (default) → need 12 - 4 = buy 8.
  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await expect(page.getByText(/4 oz already in your pantry/)).toBeVisible();
});

// An item added without an amount ("have some, didn't measure") counts as in
// stock and is kept off the generated list, even though a planned recipe needs
// it. A second ingredient the pantry lacks still appears (anchors the page).
test('unquantified pantry stock keeps an item off the generated list', async ({ page }) => {
  await signUp(page, uniqueEmail('unknownstock'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Unknown Stock Test');
  await page.getByLabel('Paste ingredients').fill('12 oz cream cheese\n2 cups all-purpose flour');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (2)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Unknown Stock Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Unknown Stock Test');
  await panel.getByRole('button', { name: 'Unknown Stock Test' }).click();

  // Add cream cheese to the pantry with NO amount → it's flagged "in stock".
  await page.goto('/pantry');
  await page.getByPlaceholder('Type an ingredient…').fill('cream cheese');
  await page.getByRole('button', { name: /cream cheese/ }).first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Quantity of cream cheese')).toHaveAttribute('placeholder', 'in stock');

  // Generate → flour (not on hand) is listed; cream cheese (in stock) is not.
  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText(/flour/i).first()).toBeVisible();
  await expect(page.getByText(/cream cheese/i)).toHaveCount(0);
});

// Bulk-import a pasted inventory list into the pantry (no AI).
test('bulk-imports a pasted list into the pantry', async ({ page }) => {
  await signUp(page, uniqueEmail('bulk'));

  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Many items' }).click();
  await page
    .getByLabel('Paste your inventory')
    .fill('2 cups flour\ncream cheese, 8 oz\neggs');
  await page.getByRole('button', { name: 'Preview' }).click();

  // All three match seeded canonicals -> one tap to add.
  await page.getByRole('button', { name: /Add 3 items/ }).click();
  await expect(page.getByText(/Added 3 items/)).toBeVisible();

  // They're now in the pantry.
  await expect(page.getByText('cream cheese')).toBeVisible();
  await expect(page.getByText('all-purpose flour')).toBeVisible();
});

// Rows that don't match an existing canonical are created as new household
// ingredients (rather than being silently skipped) and added to the pantry.
test('bulk import adds unmatched rows as new ingredients', async ({ page }) => {
  await signUp(page, uniqueEmail('bulknew'));

  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Many items' }).click();
  await page.getByLabel('Paste your inventory').fill('eggs\nflorbnak');
  await page.getByRole('button', { name: 'Preview' }).click();

  // One matches a seeded canonical (eggs); the made-up one is flagged "new".
  await expect(page.getByText(/1 added as new/)).toBeVisible();

  await page.getByRole('button', { name: /Add 2 items/ }).click();
  await expect(page.getByText(/Added 2 items/)).toBeVisible();

  // The new ingredient was created and is now in the pantry.
  await expect(page.getByText('florbnak')).toBeVisible();
});
