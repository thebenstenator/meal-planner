import { expect, test, type Page } from '@playwright/test';
import { generateList, openAddEntry, submitRecipe } from './helpers';

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

// The forecast follows a meal's money as it moves — still on a list, then
// bought — without ever counting it twice; the spending page then breaks the
// month down (ADR 0017).
test('forecasts the month once per purchase and summarizes where it went', async ({ page }) => {
  test.slow();
  await signUp(page, uniqueEmail('forecast'));
  const iso = todayISO();

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Forecast Test');
  await page.getByLabel('Paste ingredients').fill('8 oz cream cheese');
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText('Ingredients (1)')).toBeVisible();
  await submitRecipe(page);
  await expect(page.getByRole('heading', { name: 'Forecast Test' })).toBeVisible();

  await page.goto('/planner');
  const panel = await openAddEntry(page, `Add to dinner on ${iso}`);
  await panel.getByLabel('Search recipes to add').fill('Forecast Test');
  await panel.getByRole('button', { name: 'Forecast Test' }).click();

  await page.goto('/stores');
  await page.getByLabel('New store name').fill('Test Store');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Set default' }).click();

  // The meal goes on a list, priced $2.50 / 8 oz: $2.50 still to buy.
  await page.goto('/shopping-list');
  await generateList(page);
  await expect(page.getByText('cream cheese').first()).toBeVisible();
  const listUrl = page.url();
  await page.getByRole('button', { name: 'set an estimate price' }).click();
  await page.getByLabel('Package price').fill('2.50');
  await page.getByLabel('Package quantity').fill('8');
  await page.getByLabel('Package unit').fill('oz');
  await page.getByRole('button', { name: 'Save price' }).click();
  await expect(page.getByTestId('projected-total')).toContainText('$2.50');

  await page.goto('/planner');
  await expect(page.getByTestId('forecast')).toContainText('On pace for $2.50', { timeout: 15000 });

  // Bought: the same $2.50 moves from "to buy" to "spent" — nothing more is
  // coming, so the forecast steps aside rather than repeat the spend.
  await page.goto(listUrl);
  await page.getByRole('checkbox', { name: 'Check off cream cheese' }).click({ force: true });
  await expect(page.getByTestId('spent-total')).toContainText('$2.50', { timeout: 15000 });

  await page.goto('/planner');
  await expect(page.getByText('$2.50 spent').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('forecast')).toHaveCount(0);

  // The month's summary: total, category breakdown, and the meal behind it.
  await page.goto('/spending');
  const summary = page.getByTestId('month-summary');
  await expect(summary).toContainText('$2.50', { timeout: 15000 });
  await expect(summary.getByText('Where it went')).toBeVisible();
  await expect(summary.getByText('Forecast Test')).toBeVisible();
  await expect(summary).toContainText('estimated from your list prices');
});

/** Jot a manual item onto the full list page and record its price (unchecked). */
async function addPricedItem(page: Page, name: string, paid: string) {
  const box = page.getByPlaceholder('Add an item (e.g. paper towels)');
  await box.fill(name);
  await box.press('Enter');
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Add price paid for this item' }).click();
  await page.getByLabel('Actual price paid').fill(paid);
  await page.getByLabel('Actual price paid').press('Enter');
  await expect(
    page.getByRole('button', { name: `Edit price paid for this item (currently $${paid})` }),
  ).toBeVisible({ timeout: 15000 });
}

// The pre-trip check: what's still to buy against what's left of the month —
// and a checked-off item moves from one side to the other, never counted twice.
test('checks a list against what is left of the budget before the trip', async ({ page }) => {
  test.slow();
  await signUp(page, uniqueEmail('pretrip'));

  await page.goto('/household/settings');
  await page.getByLabel('Amount (USD / month)').fill('10');
  await page.getByLabel('Amount (USD / month)').press('Enter');
  await page.waitForLoadState('networkidle');

  await page.goto('/shopping-list');
  await page.getByRole('button', { name: '+ New list' }).click();
  await page.getByLabel('New list name').fill('Corner Shop');
  await page.getByRole('button', { name: 'Create list' }).click();
  await page.getByRole('link', { name: 'open full list →' }).click();
  await expect(page).toHaveURL(/\/shopping-list\/[0-9a-f-]+$/);

  const check = page.getByTestId('trip-budget-check');
  await addPricedItem(page, 'Paper Towels', '4.00');
  await expect(check).toContainText('~$4.00 still to buy', { timeout: 15000 });
  await expect(check).toContainText('leaves $6.00');

  await addPricedItem(page, 'Paper Plates', '8.00');
  await expect(check).toContainText('~$12.00 still to buy', { timeout: 15000 });
  await expect(check).toContainText('$2.00 more than the $10.00 left');
  // The projected total counts paid prices too, not just store estimates.
  await expect(page.getByTestId('projected-total')).toContainText('$12.00');

  // Bought the towels: $4 spent, $6 left, $8 still to buy — still $2 over.
  await page.getByRole('checkbox', { name: 'Check off Paper Towels' }).click({ force: true });
  await expect(check).toContainText('~$8.00 still to buy', { timeout: 15000 });
  await expect(check).toContainText('$2.00 more than the $6.00 left');
});
