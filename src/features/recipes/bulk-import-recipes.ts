import { saveRecipe, type RecipeIngredientDraft } from '@/features/recipes/api';
import { parseOneRecipe, parseRecipesText, type RecipeCandidate } from '@/features/recipes/bulk-recipes';
import { parseRecipeUrl } from '@/features/recipes/import';
import { parseIngredientBlock } from '@/features/recipes/parse-block';
import { stripControlChars } from '@/lib/utils/sanitize-text';

export interface DraftRecipe {
  title: string;
  servings: number | null;
  instructions: string | null;
  source: string | null;
  ingredients: RecipeIngredientDraft[];
  /** How many ingredient rows didn't match a canonical (for the review summary). */
  unmatched: number;
}

async function candidateToDraft(
  householdId: string,
  candidate: RecipeCandidate,
  source: string | null,
): Promise<DraftRecipe> {
  // Extracted PDF text can carry NUL/control bytes that Postgres rejects (22P05).
  // Every import path funnels through here, so clean the text once, before parse.
  const lines = candidate.ingredientLines.map(stripControlChars);
  const ingredients = lines.length
    ? await parseIngredientBlock(householdId, lines.join('\n'))
    : [];
  return {
    title: stripControlChars(candidate.title),
    servings: candidate.servings,
    instructions: candidate.instructions ? stripControlChars(candidate.instructions) : null,
    source,
    ingredients,
    unmatched: ingredients.filter((i) => !i.canonicalId).length,
  };
}

/** Parse a pasted block of one-or-more recipes (separated by `---`) into drafts. */
export async function draftsFromText(householdId: string, text: string): Promise<DraftRecipe[]> {
  const candidates = parseRecipesText(text);
  return Promise.all(candidates.map((c) => candidateToDraft(householdId, c, null)));
}

/** Parse a single uploaded text/markdown file (filename = fallback title) into a draft. */
export async function draftFromFile(
  householdId: string,
  filename: string,
  content: string,
): Promise<DraftRecipe | null> {
  const candidate = parseOneRecipe(content, filename.replace(/\.[^.]+$/, ''));
  if (!candidate || candidate.ingredientLines.length === 0) return null;
  return candidateToDraft(householdId, candidate, null);
}

export interface UrlImportResult {
  url: string;
  draft: DraftRecipe | null;
  error: string | null;
}

/** Import each URL via the free JSON-LD path only (no AI credits). */
export async function draftsFromUrls(
  householdId: string,
  urls: string[],
): Promise<UrlImportResult[]> {
  return Promise.all(
    urls.map(async (url) => {
      try {
        const { recipe } = await parseRecipeUrl(householdId, url, { jsonLdOnly: true });
        const draft = await candidateToDraft(
          householdId,
          {
            title: recipe.title,
            servings: recipe.servings,
            instructions: recipe.instructions,
            ingredientLines: recipe.ingredient_lines,
          },
          url,
        );
        return { url, draft, error: null };
      } catch (err) {
        return { url, draft: null, error: err instanceof Error ? err.message : 'Import failed' };
      }
    }),
  );
}

/** Persist a draft recipe through the same save_recipe path as manual entry. */
export function saveDraft(householdId: string, d: DraftRecipe): Promise<string> {
  return saveRecipe(
    householdId,
    {
      title: d.title,
      servings: d.servings ?? 4,
      mealTypes: [],
      tags: [],
      instructions: d.instructions ?? undefined,
      source: d.source ?? undefined,
    },
    d.ingredients,
  );
}
