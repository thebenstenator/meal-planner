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

test('create a recipe by pasting ingredients, then soft-delete and restore', async ({ page }) => {
  await signUp(page, uniqueEmail('cook'));

  await page.goto('/recipes');
  await expect(page.getByRole('heading', { name: 'Recipes' })).toBeVisible();
  await expect(page.getByText('No recipes yet')).toBeVisible();

  // Create via the paste flow — through the consolidated "Add recipe" menu.
  await page.getByRole('button', { name: 'Add recipe' }).click();
  await page.getByRole('menuitem', { name: /Enter manually/ }).click();
  await page.getByLabel('Title').fill('Test Cheesecake');
  await page.getByLabel('Paste ingredients').fill(
    ['2 cups all-purpose flour', '1 (8 oz) package cream cheese, softened', '3 large eggs'].join(
      '\n',
    ),
  );
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (3)')).toBeVisible();

  // Force-click: on mobile emulation the actionability hit-test intermittently
  // reports a sibling field as the top element even though the button is fully
  // visible and unobstructed (verified via screenshot).
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });

  // Landed on the detail page with a matched canonical ingredient.
  await expect(page.getByRole('heading', { name: 'Test Cheesecake' })).toBeVisible();
  await expect(page.getByText('cream cheese').first()).toBeVisible();

  // Appears in the library.
  await page.goto('/recipes');
  await expect(page.getByRole('link', { name: /Test Cheesecake/ })).toBeVisible();

  // Soft-delete from the detail page.
  await page.getByRole('link', { name: /Test Cheesecake/ }).click();
  await page.getByRole('button', { name: 'Delete recipe' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole('link', { name: /Test Cheesecake/ })).toHaveCount(0);

  // Restore it from "recently deleted".
  await page.getByRole('button', { name: /Show recently deleted/ }).click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('link', { name: /Test Cheesecake/ })).toBeVisible();
});
