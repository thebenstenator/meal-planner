import { expect, test, type Page } from '@playwright/test';

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

async function signIn(page: Page, email: string, password = 'password123') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app/);
}

test('plan entries sync across two sessions in realtime', async ({ browser }) => {
  const email = uniqueEmail('planner');
  const iso = todayISO();

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // Same user (same household) signed in on two "devices".
  await signUp(pageA, email);
  await signIn(pageB, email);
  await pageA.goto('/planner');
  await pageB.goto('/planner');
  await expect(pageA.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(pageB.getByRole('button', { name: 'Today' })).toBeVisible();

  // Let both realtime channels reach SUBSCRIBED before mutating, so B doesn't
  // miss the first event.
  await Promise.all([pageA.waitForTimeout(2500), pageB.waitForTimeout(2500)]);

  // A adds an "eating out" entry to today's dinner.
  await pageA.getByRole('button', { name: `Add to dinner on ${iso}` }).click({ force: true });
  await pageA.getByTestId('add-entry-panel').getByRole('button', { name: 'Eating out' }).click();
  await pageA.getByRole('button', { name: 'Add eating out' }).click();

  // It shows for A, and appears for B via realtime (no reload).
  await expect(pageA.getByText('Eating out').first()).toBeVisible();
  await expect(pageB.getByText('Eating out').first()).toBeVisible({ timeout: 15000 });

  // A removes it; it disappears for B too.
  await pageA.getByRole('button', { name: 'Remove entry' }).first().click();
  await expect(pageB.getByText('Eating out')).toHaveCount(0, { timeout: 15000 });

  await ctxA.close();
  await ctxB.close();
});
