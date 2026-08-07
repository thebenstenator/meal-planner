import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

// Free PDF path: extract the text layer in the browser (pdf.js), parse, import.
test('extracts a text PDF and bulk-imports it (no AI)', async ({ page }) => {
  await page.setContent(
    `<html><body style="font:16px serif; line-height:2">
      <div>Grandma Bread</div>
      <div>Ingredients</div>
      <div>2 cups flour</div>
      <div>1 tsp salt</div>
      <div>Directions</div>
      <div>Mix and bake.</div>
    </body></html>`,
  );
  const pdf = await page.pdf({ format: 'Letter' });
  const pdfPath = join(tmpdir(), `recipe-${Date.now()}.pdf`);
  writeFileSync(pdfPath, pdf);

  await signUp(page, uniqueEmail('pdf'));
  await page.goto('/recipes/bulk-import');
  // Use the real file-chooser flow so React's onChange fires (setInputFiles on a
  // hidden input doesn't reach the delegated listener).
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText(/upload .txt/).click(),
  ]);
  await chooser.setFiles(pdfPath);

  await expect(page.getByText('1 recipe found')).toBeVisible();
  await page.getByRole('button', { name: /Save 1 recipe/ }).click();
  await expect(page.getByText(/Saved 1 recipe/)).toBeVisible();

  await page.goto('/recipes');
  await expect(page.getByText('Grandma Bread')).toBeVisible();
});
