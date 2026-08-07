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

const TWO_RECIPES = `Cheese Dip
Ingredients
8 oz cream cheese
2 tbsp sugar
Directions
Mix well.
---
Egg Scramble
Ingredients
3 eggs
1 tbsp butter
Directions
Scramble the eggs.`;

test('bulk-imports pasted text recipes (no AI)', async ({ page }) => {
  await signUp(page, uniqueEmail('bulkrec'));

  await page.goto('/recipes/bulk-import');
  await page.getByLabel('Paste recipes').fill(TWO_RECIPES);
  await page.getByRole('button', { name: 'Parse recipes' }).click();

  await expect(page.getByText('2 recipes found')).toBeVisible();
  await page.getByRole('button', { name: /Save 2 recipes/ }).click();
  await expect(page.getByText(/Saved 2 recipes/)).toBeVisible();

  // Both are in the library.
  await page.goto('/recipes');
  await expect(page.getByText('Cheese Dip')).toBeVisible();
  await expect(page.getByText('Egg Scramble')).toBeVisible();
});
