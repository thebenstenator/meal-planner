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

async function createRecipe(
  page: Page,
  title: string,
  ingredient: string,
  /** Cookbooks to untick before saving (they start ticked). */
  unshareFrom: string[] = [],
) {
  await page.goto('/recipes/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Paste ingredients').fill(ingredient);
  await page.getByRole('button', { name: 'Add rows' }).click();
  await expect(page.getByText(/Ingredients \(\d+\)/)).toBeVisible();
  for (const cookbook of unshareFrom) {
    await page.getByLabel(cookbook, { exact: true }).uncheck();
  }
  await page.getByRole('button', { name: 'Create recipe' }).click({ force: true });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

function recipeLink(page: Page, title: string) {
  return page.getByRole('link').filter({ hasText: title });
}

// The whole cookbook contract in one flow: an owner shares their library, a
// second household joins by code and sees it, each household keeps control of
// what it added, and a member can keep a recipe out of the cookbook.
// Shopping/pantry/plan are untouched — this only exercises the recipe surface.
test('cookbook: share, join, add, opt out, and creator-only edits across two households', async ({
  browser,
}) => {
  // Two browser contexts, two signups, four recipes and the whole cookbook
  // lifecycle don't fit in the default 30s budget — this test was chronically
  // running out of time rather than genuinely failing, so give it 90s.
  test.slow();
  const ownerEmail = uniqueEmail('cookbook-owner');
  const memberEmail = uniqueEmail('cookbook-member');

  const ownerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const member = await memberCtx.newPage();

  // Owner signs up and adds a recipe (private for now), then shares the library.
  await signUp(owner, ownerEmail);
  await createRecipe(owner, 'Owner Roast', '2 lb beef\n1 onion');

  // Cookbook management lives on its own page now, reached by "Manage cookbooks".
  await owner.goto('/recipes/cookbooks');
  await owner.getByLabel('Cookbook name').fill('Family Cookbook');
  await owner.getByRole('button', { name: 'Create shared cookbook' }).click();
  // The owned-cookbook card replaces the create form.
  await expect(owner.getByText('You own this')).toBeVisible();

  // Generate an invite code and read it.
  await owner.getByRole('button', { name: 'Invite someone' }).click();
  const code = (await owner.getByTestId('cookbook-invite-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // Member signs up and joins by code.
  await signUp(member, memberEmail);
  await member.goto('/recipes/cookbooks');
  // The page settles several queries at once, so a one-shot click can land
  // mid-re-render and be dropped — and a dropped click leaves the form looking
  // exactly like one that was never clicked. Retry until the cookbook card shows
  // up; re-accepting is refused server-side before any write, so the worst a
  // redundant attempt does is flash an alert.
  const joinedCard = member.getByTestId('cookbook-card').filter({ hasText: 'Family Cookbook' });
  const joinButton = member.getByRole('button', { name: 'Join cookbook' });
  await expect(async () => {
    if (await joinButton.isVisible()) {
      await member.getByLabel('Invite code').fill(code);
      await joinButton.click();
    }
    await expect(joinedCard).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 45_000 });
  await expect(joinedCard.getByText('Shared with you')).toBeVisible();

  // Member sees the owner's recipe, badged as coming from the cookbook.
  await member.goto('/recipes');
  await expect(recipeLink(member, 'Owner Roast')).toBeVisible({ timeout: 15000 });

  // Opening it: read-only. A cookbook recipe still belongs to the household that
  // added it, so nobody else edits, favorites or deletes it.
  await recipeLink(member, 'Owner Roast').click();
  await expect(member.getByRole('heading', { name: 'Owner Roast' })).toBeVisible();
  await expect(member.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(member.getByRole('button', { name: /favorites/ })).toHaveCount(0);
  await expect(member.getByText('only they can edit or delete it')).toBeVisible();

  // Member adds their own recipe — shared into the cookbook by default…
  await createRecipe(member, 'Member Salad', '1 head lettuce\n2 tomatoes');
  // …and another they deliberately hold back by unticking the cookbook.
  await createRecipe(member, 'Member Secret', '1 cup flour', ['Family Cookbook']);

  // The owner sees the shared contribution but never the held-back one.
  await owner.goto('/recipes');
  await expect(recipeLink(owner, 'Member Salad')).toBeVisible({ timeout: 15000 });
  await expect(recipeLink(owner, 'Member Secret')).toHaveCount(0);

  // The cookbook card states how much of your library is actually in it, so a
  // household that joined can't wrongly assume everything is shared.
  await member.goto('/recipes/cookbooks');
  await expect(member.getByText('1 of your 2 recipes are here.')).toBeVisible({ timeout: 15000 });

  // The member can change their mind later: unshare from the edit form.
  await member.goto('/recipes');
  await recipeLink(member, 'Member Salad').click();
  await member.getByRole('link', { name: 'Edit' }).click();
  await member.getByLabel('Family Cookbook', { exact: true }).uncheck();
  await member.getByRole('button', { name: 'Save changes' }).click({ force: true });
  await expect(member.getByRole('heading', { name: 'Member Salad' })).toBeVisible();

  await owner.goto('/recipes');
  await expect(recipeLink(owner, 'Member Salad')).toHaveCount(0, { timeout: 15000 });

  // Owner deletes their own recipe; it disappears for the member too.
  await recipeLink(owner, 'Owner Roast').click();
  await owner.getByRole('button', { name: 'Delete recipe' }).click();
  await owner.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(owner).toHaveURL(/\/recipes$/);

  await member.goto('/recipes');
  await expect(recipeLink(member, 'Owner Roast')).toHaveCount(0, { timeout: 15000 });
  // The member's own recipes are still there.
  await expect(recipeLink(member, 'Member Salad')).toBeVisible();
  await expect(recipeLink(member, 'Member Secret')).toBeVisible();

  await ownerCtx.close();
  await memberCtx.close();
});

// A household can run several cookbooks at once, and each recipe picks which
// ones it goes into — the two things v1 explicitly couldn't do.
test('cookbooks: a household can be in several, and a recipe picks which', async ({ page }) => {
  test.slow(); // two cookbooks, two recipes and a bulk share — also past 30s.
  await signUp(page, uniqueEmail('multi-cookbook'));
  await createRecipe(page, 'House Chili', '1 lb beef\n1 can beans');

  await page.goto('/recipes/cookbooks');
  await page.getByLabel('Cookbook name').fill('Family Cookbook');
  await page.getByRole('button', { name: 'Create shared cookbook' }).click();
  // Creating a cookbook replaces the form with its card.
  await expect(
    page.getByTestId('cookbook-card').filter({ hasText: 'Family Cookbook' }),
  ).toBeVisible({ timeout: 15000 });

  // The create/join forms collapse once you're in a cookbook; reopen them.
  await page.getByRole('button', { name: 'Start or join another cookbook' }).click();
  await page.getByLabel('Cookbook name').fill('Supper Club');
  await page.getByRole('button', { name: 'Create shared cookbook' }).click();
  await expect(page.getByTestId('cookbook-card').filter({ hasText: 'Supper Club' })).toBeVisible({
    timeout: 15000,
  });

  // Each cookbook you're in becomes a tab on the library itself.
  await page.goto('/recipes');
  await expect(page.getByRole('tab', { name: 'Supper Club' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('tab', { name: 'Family Cookbook' })).toBeVisible();

  // A new recipe offers both cookbooks and can go into just one of them; the
  // household is a fixed destination, not a choice.
  await createRecipe(page, 'Club Tart', '2 cups flour', ['Family Cookbook']);
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByLabel('My household')).toBeDisabled();
  await expect(page.getByLabel('Family Cookbook', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Supper Club', { exact: true })).toBeChecked();

  // The tabs filter by where a recipe lives. House Chili predates both cookbooks,
  // so creating them seeded it into each; Club Tart only went to Supper Club.
  await page.goto('/recipes');
  await page.getByRole('tab', { name: 'Family Cookbook' }).click();
  await expect(recipeLink(page, 'House Chili')).toBeVisible();
  await expect(recipeLink(page, 'Club Tart')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Supper Club' }).click();
  await expect(recipeLink(page, 'Club Tart')).toBeVisible();
  await expect(recipeLink(page, 'House Chili')).toBeVisible();

  // …and "All" is always there to search across the lot.
  await page.getByRole('tab', { name: 'Family Cookbook' }).click();
  await page.getByRole('tab', { name: 'All' }).click();
  await expect(recipeLink(page, 'Club Tart')).toBeVisible();
  await expect(recipeLink(page, 'House Chili')).toBeVisible();

  // Share-back: the cookbook card admits what's missing and offers to add the
  // rest in one go. This is the opt-in a household that *joined* a cookbook
  // needs, since joining (unlike creating) shares nothing on its own.
  await page.goto('/recipes/cookbooks');
  const familyCard = page.getByTestId('cookbook-card').filter({ hasText: 'Family Cookbook' });
  await expect(familyCard.getByText('1 of your 2 recipes are here.')).toBeVisible({
    timeout: 15000,
  });
  await familyCard.getByRole('button', { name: 'Share the other 1' }).click();
  await familyCard.getByRole('button', { name: 'Share them' }).click();
  await expect(familyCard.getByText('All 2 of your recipes are here.')).toBeVisible({
    timeout: 15000,
  });

  await page.goto('/recipes');
  await page.getByRole('tab', { name: 'Family Cookbook' }).click();
  await expect(recipeLink(page, 'Club Tart')).toBeVisible();
});
