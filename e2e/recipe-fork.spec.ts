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

async function createRecipe(page: Page, title: string, ingredients: string) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(ingredients);
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText(/Ingredients \(\d+\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

function recipeLink(page: Page, title: string) {
  return page.getByRole('link').filter({ hasText: title });
}

// The copy-on-edit contract: a household that a recipe is shared *with* can edit
// it, but the edit lands on a new copy they own — the shared original is never
// touched, and the copy is private until they choose to share it.
test('a non-owner editing a shared recipe forks it into their own copy', async ({ browser }) => {
  // Two contexts, two signups, a cookbook handshake and a fork don't fit 30s.
  test.slow();
  const ownerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const member = await memberCtx.newPage();

  // Owner shares a recipe through a cookbook.
  await signUp(owner, uniqueEmail('fork-owner'));
  await createRecipe(owner, 'Owner Roast', '2 lb beef\n1 onion');
  await owner.goto('/recipes/cookbooks');
  await owner.getByLabel('Cookbook name').fill('Family Cookbook');
  await owner.getByRole('button', { name: 'Create shared cookbook' }).click();
  await expect(owner.getByText('You own this')).toBeVisible();
  await owner.getByRole('button', { name: 'Invite someone' }).click();
  const code = (await owner.getByTestId('cookbook-invite-code').innerText()).trim();

  // Member joins by code (retry until the card shows — a click can land mid
  // re-render; re-accepting is refused server-side, so a redundant try is safe).
  await signUp(member, uniqueEmail('fork-member'));
  await member.goto('/recipes/cookbooks');
  const joinedCard = member.getByTestId('cookbook-card').filter({ hasText: 'Family Cookbook' });
  const joinButton = member.getByRole('button', { name: 'Join cookbook' });
  await expect(async () => {
    if (await joinButton.isVisible()) {
      await member.getByLabel('Invite code').fill(code);
      await joinButton.click();
    }
    await expect(joinedCard).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 45_000 });

  // Member sees the shared recipe and forks it: "Edit a copy" → change → save.
  await member.goto('/recipes');
  await expect(recipeLink(member, 'Owner Roast')).toBeVisible({ timeout: 15000 });
  await recipeLink(member, 'Owner Roast').click();
  await member.getByRole('link', { name: 'Edit a copy' }).click();
  await expect(member.getByText('Saving makes your own copy')).toBeVisible();
  await member.getByLabel('Title').fill('My Roast Remix');
  await member.getByRole('button', { name: 'Save as my copy' }).click({ force: true });

  // The copy is the member's own now: badged as a copy, and editable in place
  // (the owner-only "Edit", not "Edit a copy").
  await expect(member.getByRole('heading', { name: 'My Roast Remix' })).toBeVisible();
  await expect(member.getByText('Your copy')).toBeVisible();
  await expect(member.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();

  // The untouched shared original is still there alongside the copy — the fork
  // added a row, it didn't convert the original.
  await member.goto('/recipes');
  await expect(recipeLink(member, 'Owner Roast')).toBeVisible();
  await expect(recipeLink(member, 'My Roast Remix')).toBeVisible();

  // The owner's recipe kept its name (no in-place mutation), and the private
  // copy never reaches them.
  await owner.goto('/recipes');
  await expect(recipeLink(owner, 'Owner Roast')).toBeVisible({ timeout: 15000 });
  await expect(recipeLink(owner, 'My Roast Remix')).toHaveCount(0);

  await ownerCtx.close();
  await memberCtx.close();
});
