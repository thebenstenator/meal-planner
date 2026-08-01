import { expect, test } from '@playwright/test';

test('landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mealplan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible();
});

test('health route reports ok', async ({ page }) => {
  await page.goto('/health');
  await expect(page.getByTestId('health-payload')).toContainText('"status": "ok"');
});

test('protected route redirects to login when signed out', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
