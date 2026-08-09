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
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
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
