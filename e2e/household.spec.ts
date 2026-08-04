import { expect, test, type Page } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string, password = 'password123') {
  await page.goto('/login');
  // Toggle from the default sign-in view into sign-up.
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app/);
}

test('new user gets their own household automatically', async ({ page }) => {
  await signUp(page, uniqueEmail('solo'));
  await expect(page.getByTestId('active-household')).toContainText("'s Household");
});

test('two users share one household via an invite code', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const emailA = uniqueEmail('owner');
  const emailB = uniqueEmail('partner');

  // A signs up and generates an invite code.
  await signUp(pageA, emailA);
  await pageA.goto('/household/settings');
  await pageA.getByRole('button', { name: 'Generate invite code' }).click();
  const code = (await pageA.getByTestId('invite-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // B signs up (gets their own household), then joins A's via the code.
  await signUp(pageB, emailB);
  await pageB.goto('/household/settings');
  await pageB.getByLabel('Invite code').fill(code);
  // Force-click: on mobile emulation the actionability hit-test intermittently
  // reports the field directly above as the top element even though the button
  // is fully visible and clickable.
  await pageB.getByRole('button', { name: 'Join household' }).click({ force: true });

  await expect(pageB.getByRole('status')).toContainText('Joined');
  // B now sees the shared household and A as a co-member.
  await expect(pageB.getByText(emailA)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
