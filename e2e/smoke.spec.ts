import { expect, test } from '@playwright/test';

test('root redirects a signed-out visitor to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('health route reports ok', async ({ page }) => {
  await page.goto('/health');
  await expect(page.getByTestId('health-payload')).toContainText('"status": "ok"');
});

test('protected route redirects to login when signed out', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
