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

async function createRecipe(page: Page, title: string, ingredient: string) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(ingredient);
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText(/Ingredients \(\d+\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

function recipeLink(page: Page, title: string) {
  return page.getByRole('link').filter({ hasText: title });
}

// The whole pool contract in one flow: an owner shares their library, a second
// household joins by code and sees it, members can add but not delete/edit
// others', and an owner delete propagates to everyone. Shopping/pantry/plan are
// untouched — this only ever exercises the recipe surface.
test('recipe pool: share, join, add, and owner-only delete across two households', async ({
  browser,
}) => {
  const ownerEmail = uniqueEmail('pool-owner');
  const memberEmail = uniqueEmail('pool-member');

  const ownerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const member = await memberCtx.newPage();

  // Owner signs up and adds a recipe (private for now), then shares the library.
  await signUp(owner, ownerEmail);
  await createRecipe(owner, 'Owner Roast', '2 lb beef\n1 onion');

  await owner.goto('/recipes');
  await owner.getByLabel('Pool name').fill('Family Cookbook');
  await owner.getByRole('button', { name: 'Create shared pool' }).click();
  // The owned-pool card replaces the create form.
  await expect(owner.getByText('You own this')).toBeVisible();

  // Generate an invite code and read it.
  await owner.getByRole('button', { name: 'Invite someone' }).click();
  const code = (await owner.getByTestId('pool-invite-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // Member signs up and joins by code.
  await signUp(member, memberEmail);
  await member.goto('/recipes');
  await member.getByLabel('Invite code').fill(code);
  await member.getByRole('button', { name: 'Join pool' }).click();
  await expect(member.getByText('Shared with you')).toBeVisible({ timeout: 15000 });

  // Member sees the owner's recipe, badged as coming from the pool.
  await expect(recipeLink(member, 'Owner Roast')).toBeVisible({ timeout: 15000 });

  // Opening it: read-only. No edit, no favorite, and delete is owner-only.
  await recipeLink(member, 'Owner Roast').click();
  await expect(member.getByRole('heading', { name: 'Owner Roast' })).toBeVisible();
  await expect(member.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(member.getByRole('button', { name: /favorites/ })).toHaveCount(0);
  await expect(member.getByText('only the pool owner can delete it')).toBeVisible();

  // Member adds their own recipe — shared into the pool by default.
  await createRecipe(member, 'Member Salad', '1 head lettuce\n2 tomatoes');

  // The owner sees the member's contribution.
  await owner.goto('/recipes');
  await expect(recipeLink(owner, 'Member Salad')).toBeVisible({ timeout: 15000 });

  // Owner deletes their own recipe; it disappears for the member too.
  await recipeLink(owner, 'Owner Roast').click();
  await owner.getByRole('button', { name: 'Delete recipe' }).click();
  await owner.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(owner).toHaveURL(/\/recipes$/);

  await member.goto('/recipes');
  await expect(recipeLink(member, 'Owner Roast')).toHaveCount(0, { timeout: 15000 });
  // The member's own recipe is still there.
  await expect(recipeLink(member, 'Member Salad')).toBeVisible();

  await ownerCtx.close();
  await memberCtx.close();
});
