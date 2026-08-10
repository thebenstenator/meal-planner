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
