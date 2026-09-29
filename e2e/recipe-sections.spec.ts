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

// Recipes like "lemon curd cookies" group ingredients under headings. Pasted
// headings become sections (not ingredients), survive saving, show as headings
// on the recipe, and can be renamed from the editor.
test('ingredient sections: pasted headings group the list, and can be renamed', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('sections'));

  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill('Lemon Curd Cookies');
  await page
    .getByLabel('Paste ingredients')
    .fill(
      [
        'Lemon curd:',
        '100 g sugar',
        '3 egg yolks',
        '',
        'Lemon cookies:',
        '150 g sugar',
        '2 eggs',
      ].join('\n'),
    );
  await page.getByRole('button', { name: 'Add rows' }).click();

  // Headings aren't counted as ingredients; they become editable section names.
  await expect(page.getByText('Ingredients (4)')).toBeVisible();
  const names = page.getByLabel('Section name');
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveValue('Lemon curd');
  await expect(names.nth(1)).toHaveValue('Lemon cookies');

  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Lemon Curd Cookies' })).toBeVisible();

  // The recipe page shows each section under its own heading, in order.
  const curd = page.getByRole('heading', { name: 'Lemon curd', level: 3 });
  const cookies = page.getByRole('heading', { name: 'Lemon cookies', level: 3 });
  await expect(curd).toBeVisible();
  await expect(cookies).toBeVisible();
  const curdList = curd.locator('xpath=following-sibling::ul[1]');
  await expect(curdList.getByRole('listitem')).toHaveCount(2);
  await expect(curdList).toContainText('3 egg yolks');
  await expect(cookies.locator('xpath=following-sibling::ul[1]')).toContainText('2 eggs');

  // Rename a section in the editor.
  await page.getByRole('link', { name: 'Edit' }).click();
  const second = page.getByLabel('Section name').nth(1);
  await expect(second).toHaveValue('Lemon cookies');
  await second.fill('Cookie dough');
  await second.press('Enter');
  await page.getByRole('button', { name: 'Save changes' }).click({ force: true });

  await expect(page.getByRole('heading', { name: 'Cookie dough', level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lemon cookies', level: 3 })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Lemon curd', level: 3 })).toBeVisible();
});
