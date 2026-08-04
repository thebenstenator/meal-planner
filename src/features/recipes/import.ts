import { matchCanonical } from '@/features/ingredients/api';
import type { RecipeDetail, RecipeIngredientDraft } from '@/features/recipes/api';
import { supabase } from '@/lib/supabase/client';

export interface ImageInput {
  media_type: string;
  data: string; // base64, no data: prefix
}

interface ParsedIngredient {
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  descriptor: string | null;
  is_optional: boolean;
  confidence: number;
}

export interface ParsedRecipe {
  title: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  instructions: string | null;
  ingredients: ParsedIngredient[];
}

/** Thrown when the AI parse fails or the household hit its monthly limit. */
export class ImportError extends Error {
  constructor(
    message: string,
    readonly limitReached = false,
  ) {
    super(message);
  }
}

const LOW_CONFIDENCE = 0.6;

/** Read an image File into the base64 shape the Edge Function expects. */
export function fileToImage(file: File): Promise<ImageInput & { preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string; // data:<mime>;base64,<data>
      const comma = url.indexOf(',');
      const media_type = url.slice(5, url.indexOf(';'));
      resolve({ media_type, data: url.slice(comma + 1), preview: url });
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

/** Call the parse-recipe Edge Function (Anthropic key stays server-side). */
export async function parseRecipeImages(
  householdId: string,
  images: ImageInput[],
): Promise<ParsedRecipe> {
  const { data, error } = await supabase.functions.invoke('parse-recipe', {
    body: { images, household_id: householdId },
  });
  if (error) {
    let body: { error?: string; limitReached?: boolean } | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) body = await ctx.json();
    } catch {
      // non-JSON error body
    }
    throw new ImportError(body?.error ?? 'Could not read that recipe', !!body?.limitReached);
  }
  return data.recipe as ParsedRecipe;
}

/**
 * Turn a parsed recipe into a review-ready RecipeDetail: match each ingredient
 * to a canonical one and flag low-confidence / unmatched rows for review.
 */
export async function toImportDetail(
  householdId: string,
  parsed: ParsedRecipe,
): Promise<RecipeDetail> {
  const ingredients: RecipeIngredientDraft[] = await Promise.all(
    parsed.ingredients.map(async (ing) => {
      const match = ing.name
        ? await matchCanonical(householdId, ing.name).catch(() => null)
        : null;
      return {
        rawText: ing.raw_text,
        quantity: ing.quantity,
        unit: ing.unit,
        canonicalId: match?.canonicalIngredientId ?? null,
        canonicalName: match?.name ?? null,
        descriptor: ing.descriptor,
        isOptional: ing.is_optional,
        parseConfidence: ing.confidence,
        needsReview: match === null || ing.confidence < LOW_CONFIDENCE,
      };
    }),
  );

  return {
    id: '',
    title: parsed.title,
    description: null,
    mealTypes: [],
    servings: parsed.servings ?? 4,
    prepMinutes: parsed.prep_minutes,
    cookMinutes: parsed.cook_minutes,
    instructions: parsed.instructions,
    source: 'Photo import',
    tags: [],
    notes: null,
    rating: null,
    timesCooked: 0,
    ingredients,
  };
}
