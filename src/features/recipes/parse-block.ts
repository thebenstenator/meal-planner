import { matchCanonical } from '@/features/ingredients/api';
import type { RecipeIngredientDraft } from '@/features/recipes/api';
import { assignSections } from '@/features/recipes/sections';
import { parse } from '@/lib/ingredients';

const LOW_CONFIDENCE = 0.6;

function toDraft(
  parsed: ReturnType<typeof parse>,
  match: Awaited<ReturnType<typeof matchCanonical>>,
  section: string | null = null,
): RecipeIngredientDraft {
  return {
    rawText: parsed.raw,
    quantity: parsed.quantity,
    unit: parsed.unit,
    canonicalId: match?.canonicalIngredientId ?? null,
    canonicalName: match?.name ?? null,
    parsedName: parsed.name || null,
    descriptor: parsed.descriptor,
    isOptional: parsed.isOptional,
    parseConfidence: parsed.confidence,
    // Surface for a two-tap human fix when we couldn't match or weren't sure.
    needsReview: match === null || parsed.confidence < LOW_CONFIDENCE,
    section,
  };
}

/** Parse one raw line and match it to a canonical ingredient. */
export async function parseIngredientLine(
  householdId: string,
  rawText: string,
): Promise<RecipeIngredientDraft> {
  const parsed = parse(rawText);
  const match = parsed.name ? await matchCanonical(householdId, parsed.name).catch(() => null) : null;
  return toDraft(parsed, match);
}

/**
 * Parse a pasted block of ingredient lines through the engine, then match each
 * to a canonical ingredient. One matcher call per line, run in parallel.
 * Heading lines ("Lemon curd:", "For the frosting") aren't ingredients — they
 * become the section of the lines beneath them.
 */
export async function parseIngredientBlock(
  householdId: string,
  text: string,
): Promise<RecipeIngredientDraft[]> {
  const lines = assignSections(text.split(/\r?\n/));

  const parsed = lines.map((l) => parse(l.line));
  const matches = await Promise.all(
    parsed.map((p) => (p.name ? matchCanonical(householdId, p.name).catch(() => null) : null)),
  );

  return parsed.map((p, i) => toDraft(p, matches[i] ?? null, lines[i]?.section ?? null));
}
