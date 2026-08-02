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
 * Run the matcher and assert the result contains `expected`. Uses an
 * auto-retrying assertion so it waits for React to render the *new* result
 * rather than reading stale text from the previous match.
 */
async function expectMatch(page: Page, raw: string, expected: RegExp) {
  await page.getByLabel('Raw name').fill(raw);
  await page.getByRole('button', { name: 'Match' }).click();
  await expect(page.getByTestId('match-result')).toContainText(expected);
}

test('matcher resolves names across strategies (ordering + threshold)', async ({ page }) => {
  await signUp(page, uniqueEmail('matcher'));
  await page.goto('/ingredients');
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();

  // Each strategy is distinguishable by the method label it returns.
  await expectMatch(page, 'cream cheese', /cream cheese.*exact/is);
  await expectMatch(page, 'philadelphia', /cream cheese.*alias/is);
  await expectMatch(page, 'philly cream cheese', /cream cheese.*trigram/is); // the demo
  await expectMatch(page, 'zzxq nonsense words', /no confident match/i); // below threshold
});
