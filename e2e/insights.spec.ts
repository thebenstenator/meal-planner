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

// The home dashboard is premium-gated (testers are premium by default). A fresh
// account has no stale recipes, expiring pantry, or repeats — so the smart
// section mounts, the insights hook runs against real data without error, and
// the empty state shows.
test('home shows the smart-insights dashboard with an empty state for a new account', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('insights'));

  await expect(page.getByRole('heading', { name: 'Your kitchen' })).toBeVisible();
  await expect(page.getByTestId('insights')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Nothing needs your attention right now/)).toBeVisible();

  // The dashboard's primary actions are present.
  await expect(page.getByRole('link', { name: 'Open planner' })).toBeVisible();
});
