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

async function createRecipe(page: Page, title: string, lines: string[]) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(lines.join('\n'));
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText(`Ingredients (${lines.length})`)).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

function dialog(page: Page) {
  // The modal is the only thing on the page with this heading.
  return page.locator('div.fixed').filter({
    has: page.getByRole('heading', { name: 'Add to shopping list' }),
  });
}

// From a recipe: only what isn't in the pantry is offered, everything starts
// checked, unchecking ("have it") stocks the pantry instead of the list, and
// the rest lands on a list — the one you pick when there's more than one.
test('recipe → shopping list: skips pantry, stocks "have it", picks a list', async ({ page }) => {
  await signUp(page, uniqueEmail('recipe2list'));

  // Cream cheese is on hand (no amount given → counts as fully stocked).
  await page.goto('/pantry');
  // Pick from the dropdown and tap Add (a bare Enter can land before the
  // page is ready and get dropped).
  await page.getByPlaceholder('Type an ingredient…').fill('cream cheese');
  await page.getByRole('button', { name: /cream cheese/ }).first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'cream cheese' })).toBeVisible();

  await createRecipe(page, 'Banana Bread', ['8 oz cream cheese', '3 banana', '2 cup flour']);
  const recipeUrl = page.url();

  // --- First pass: no lists yet. ---
  await page.getByRole('button', { name: 'Add to shopping list' }).click();
  const dlg = dialog(page);
  const banana = dlg.getByRole('checkbox', { name: /Add banana/i });
  const flour = dlg.getByRole('checkbox', { name: /Add .*flour/i });
  await expect(banana).toBeChecked();
  await expect(flour).toBeChecked();
  // Already in the pantry → not offered at all.
  await expect(dlg.getByRole('checkbox', { name: /cream cheese/i })).toHaveCount(0);
  await expect(dlg.getByText(/start your first list/i)).toBeVisible();

  // "I have bananas" — goes to the pantry, not the list.
  await banana.uncheck();
  await expect(dlg.getByText('have it → pantry')).toBeVisible();
  await dlg.getByRole('button', { name: 'Add 1 to list' }).click();
  await expect(dlg.getByText(/Added 1 item to your list\. Stocked 1 in your pantry\./)).toBeVisible();

  await dlg.getByRole('link', { name: 'View list' }).click();
  await expect(page).toHaveURL(/\/shopping-list\/[^/?]+$/);
  await expect(page.getByRole('checkbox', { name: /Check off .*flour/i })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Check off banana/i })).toHaveCount(0);

  await page.goto('/pantry');
  await expect(page.getByRole('listitem').filter({ hasText: 'banana' }).first()).toBeVisible();

  // --- Second pass: two lists, so a picker appears. ---
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: '+ New list' }).click();
  await page.getByLabel('New list name').fill('Costco');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('tab', { name: 'Costco', selected: true })).toBeVisible();

  await page.goto(recipeUrl);
  await expect(page.getByRole('heading', { name: 'Banana Bread' })).toBeVisible();

  await page.getByRole('button', { name: 'Add to shopping list' }).click();
  const dlg2 = dialog(page);
  // Bananas are stocked now, so only flour is still needed. Flour being offered
  // again also shows that putting it on a list didn't stock the pantry — that
  // only happens when it's checked off.
  await expect(dlg2.getByRole('checkbox', { name: /Add .*flour/i })).toBeChecked();
  await expect(dlg2.getByRole('checkbox', { name: /Add banana/i })).toHaveCount(0);

  await dlg2.getByLabel('Add to').selectOption({ label: 'Costco' });
  await dlg2.getByRole('button', { name: 'Add 1 to list' }).click();
  await expect(dlg2.getByText(/Added 1 item to your list\./)).toBeVisible();
  await dlg2.getByRole('link', { name: 'View list' }).click();

  await expect(page.getByRole('heading', { name: 'Costco' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Check off .*flour/i })).toBeVisible();
  // The amount carries over (the engine may convert it to the ingredient's base
  // unit, e.g. 2 cup → grams, so don't pin the number).
  await expect(page.getByRole('textbox', { name: /How many .*flour/i })).toHaveValue(/^\d/);
});
