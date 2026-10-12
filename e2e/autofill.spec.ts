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

async function createRecipe(page: Page, title: string, ingredient: string) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(ingredient);
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText(/Ingredients \(\d+\)/)).toBeVisible();
  // A real click, not force: on a phone the fixed bottom nav can cover the
  // button, and a forced click lands on the nav instead.
  const create = page.getByRole('button', { name: 'Create recipe' });
  await create.scrollIntoViewIfNeeded();
  await create.click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

// The flagship premium flow, exercised on the free "all favorites" path so it
// needs no AI credits: build a couple of library recipes, auto-fill the month
// (dinner only), and confirm real plan entries land on the calendar.
test('auto-fill a month from the recipe library (all favorites)', async ({ page }) => {
  await signUp(page, uniqueEmail('autofill'));

  await createRecipe(page, 'Sheet-Pan Chicken', '2 chicken breasts\n1 cup rice');
  await createRecipe(page, 'Veggie Stir-Fry', '2 cups broccoli\n1 tbsp soy sauce');

  await page.goto('/planner');
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();

  await page.getByRole('button', { name: /Auto-fill month/ }).click();

  // No AI: choose "All favorites", dinner only, then build.
  await page.getByRole('button', { name: 'All favorites' }).click();
  await page.getByRole('button', { name: 'Dinner only' }).click();
  await page.getByRole('button', { name: 'Build a plan' }).click();

  // Review step lists proposed meals from the library. Match the visible row
  // title (a <span>), not the hidden <option>s in each row's swap <select>.
  await expect(page.getByRole('button', { name: /Fill \d+ meals?/ })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('span', { hasText: 'Sheet-Pan Chicken' }).first()).toBeVisible();

  // Commit, panel closes, and entries show on the planner.
  await page.getByRole('button', { name: /Fill \d+ meals?/ }).click();
  await expect(page.getByRole('button', { name: /Fill \d+ meals?/ })).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.getByText(/Sheet-Pan Chicken|Veggie Stir-Fry/).first()).toBeVisible();
});

async function pricedRecipe(page: Page, title: string, ingredient: string, price: string) {
  await createRecipe(page, title, ingredient);
  await page.getByRole('button', { name: 'set a price' }).click();
  await page.getByLabel('Meal price').fill(price);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('recipe-cost')).toContainText(`$${price}`);
}

// Budget-aware auto-fill (ADR 0018): with a limit, the priciest meals give way to
// cheaper ones — the favorite survives only where it fits.
test('auto-fill swaps pricier meals for cheaper ones to fit a budget', async ({ page }) => {
  test.slow();
  await signUp(page, uniqueEmail('autofillbudget'));

  await pricedRecipe(page, 'Steak Night', '1 lb steak', '30.00');
  await page.getByRole('button', { name: 'Add to favorites' }).click();
  await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
  await pricedRecipe(page, 'Bean Chili', '2 cups beans', '5.00');
  await pricedRecipe(page, 'Lentil Curry', '1 cup lentils', '6.00');

  await page.goto('/planner');
  await page.getByRole('button', { name: /Auto-fill month/ }).click();
  await page.getByRole('button', { name: 'All favorites' }).click();
  await page.getByRole('button', { name: 'Dinner only' }).click();

  const steakRows = page.locator('li span.truncate', { hasText: 'Steak Night' });
  const fill = page.getByRole('button', { name: /Fill \d+ meals?/ });

  // No budget: the favorite leads, and the review prices the plan.
  await page.getByRole('button', { name: 'Build a plan' }).click();
  await expect(fill).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('autofill-total')).toContainText('for these meals');
  const before = await steakRows.count();
  expect(before).toBeGreaterThan(0);

  // An unreachable $1 limit: swaps as far as variety allows, and says it's over.
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByLabel('Keep new meals under').check();
  await page.getByLabel('Budget for new meals').fill('1');
  await page.getByRole('button', { name: 'Build a plan' }).click();
  await expect(fill).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Swapped \d+ pricier meals? for cheaper ones/)).toBeVisible();
  await expect(page.getByTestId('autofill-total')).toContainText('over your $1.00');
  expect(await steakRows.count()).toBeLessThan(before);
});
