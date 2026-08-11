import { expect, type Page } from '@playwright/test';

/**
 * Open a planner day/slot's "add entry" panel and wait until it's actually
 * there. The trigger click can be dropped if it lands during a re-render (the
 * plan query resolving just after navigation), so retry the click until the
 * panel's search field appears — much steadier in CI than a one-shot force click.
 */
export async function openAddEntry(page: Page, buttonName: string) {
  const trigger = page.getByRole('button', { name: buttonName });
  const panel = page.getByTestId('add-entry-panel');
  await expect(async () => {
    await trigger.click({ force: true });
    await expect(panel.getByLabel('Search recipes to add')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  return panel;
}

/**
 * Generate a list from the shopping-list page. Generation now lives behind a
 * modal ("Generate a list" opens it; "Generate list" runs it), so this opens the
 * modal then triggers generation.
 */
export async function generateList(page: Page) {
  await page.getByRole('button', { name: 'Generate a list' }).click();
  await page.getByRole('button', { name: 'Generate list' }).click({ force: true });
}
