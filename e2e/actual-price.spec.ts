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

// Recording an actual price at check-off overrides the estimate in the Spent total.
test('records an actual price and reflects it in Spent', async ({ page }) => {
  // Signup, recipe, plan, store, list generation and two check-offs — too much
  // for the default 30s budget once any single step runs slow.
  test.slow();
  await signUp(page, uniqueEmail('actual'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Actual Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Actual Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Actual Test');
  await panel.getByRole('button', { name: 'Actual Test' }).click();

  await page.goto('/stores');
  await page.getByLabel('New store name').fill('Test Store');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Set default' }).click();

  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  await page.getByRole('button', { name: 'set an estimate price' }).click();
  await page.getByLabel('Package price').fill('2.50');
  await page.getByLabel('Package quantity').fill('8');
  await page.getByLabel('Package unit').fill('oz');
  await page.getByRole('button', { name: 'Save price' }).click();
  await expect(page.getByTestId('projected-total')).toContainText('$2.50');

  // Check it off (one tap), then record the actual price paid.
  await page.getByRole('checkbox', { name: 'Check off cream cheese' }).click({ force: true });
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('spent-total')).toContainText('$2.50'); // estimate first
  await page.getByRole('button', { name: /Edit price paid/ }).click();
  await page.getByLabel('Actual price paid').fill('3.10');
  await page.getByLabel('Actual price paid').press('Enter');
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('spent-total')).toContainText('$3.10');
  await expect(page.getByText('paid')).toBeVisible();

  // A manual item with no estimate can be priced inline too — no detours.
  const addBox = page.getByPlaceholder('Add an item (e.g. paper towels)');
  await addBox.fill('Paper Towels');
  await addBox.press('Enter');
  await expect(page.getByText('Paper Towels', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add price paid for this item' }).click();
  await page.getByLabel('Actual price paid').fill('5.00');
  await page.getByLabel('Actual price paid').press('Enter');
  // Wait for the price to actually land — the row turns back into a "$5.00 paid"
  // button. networkidle is no barrier for the mutation, and checking off before
  // it landed left Spent sitting at $3.10.
  await expect(page.getByRole('button', { name: /currently \$5\.00/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('checkbox', { name: 'Check off Paper Towels' }).click({ force: true });
  await expect(page.getByTestId('spent-total')).toContainText('$8.10', { timeout: 15000 });
});
