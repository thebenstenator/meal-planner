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

test('setting your name updates the avatar initials', async ({ page }) => {
  await signUp(page, uniqueEmail('name'));

  // No name yet → avatar falls back to email initials.
  const avatar = page.getByRole('button', { name: 'Account menu' });
  await expect(avatar).not.toContainText('BA');

  await avatar.click();
  await page.getByRole('menuitem', { name: 'Household settings' }).click();
  const nameForm = page.locator('form:has(#display-name)');
  await nameForm.locator('#display-name').fill('Ben A');
  await nameForm.getByRole('button', { name: 'Save' }).click();

  // Avatar updates to the name's initials without a reload.
  await expect(avatar).toContainText('BA');
});

test('the avatar menu navigates to a hidden page and signs out', async ({ page }) => {
  await signUp(page, uniqueEmail('menu'));

  // A less-used destination lives behind the avatar.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Household settings' }).click();
  await expect(page).toHaveURL(/household\/settings/);

  // Sign out from the same menu.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});
