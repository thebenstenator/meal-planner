export interface RecipeCandidate {
  title: string;
  servings: number | null;
  instructions: string | null;
  ingredientLines: string[];
}

const STEP_HEADER = /^\s*(instructions?|directions?|method|steps|preparation)\s*:?\s*$/i;
const ING_HEADER = /^\s*ingredients?\s*:?\s*$/i;

/**
 * Parse one recipe's text into a candidate — no AI. Title is the first line;
 * "Ingredients" / "Directions" (etc.) headers split the two sections when
 * present, otherwise a heuristic treats the leading short lines as ingredients
 * and the first long/sentence line onward as instructions.
 */
export function parseOneRecipe(block: string, fallbackTitle?: string): RecipeCandidate | null {
  const lines = block.split(/\r?\n/).map((l) => l.trim());
  const firstIdx = lines.findIndex((l) => l.length > 0);
  if (firstIdx === -1) return null;

  let title: string;
  let body: string[];
  if (ING_HEADER.test(lines[firstIdx] as string)) {
    title = fallbackTitle?.trim() || 'Untitled recipe';
    body = lines;
  } else {
    title = (lines[firstIdx] as string) || fallbackTitle?.trim() || 'Untitled recipe';
    body = lines.slice(firstIdx + 1);
  }

  const ingHeader = body.findIndex((l) => ING_HEADER.test(l));
  const stepHeader = body.findIndex((l) => STEP_HEADER.test(l));

  let ingredientLines: string[];
  let instructions: string | null = null;

  if (stepHeader >= 0) {
    const start = ingHeader >= 0 && ingHeader < stepHeader ? ingHeader + 1 : 0;
    ingredientLines = body.slice(start, stepHeader).filter(Boolean);
    instructions = body.slice(stepHeader + 1).filter(Boolean).join('\n') || null;
  } else if (ingHeader >= 0) {
    ingredientLines = body.slice(ingHeader + 1).filter(Boolean);
  } else {
    const nonEmpty = body.filter(Boolean);
    let splitAt = nonEmpty.length;
    for (let i = 0; i < nonEmpty.length; i++) {
      const line = nonEmpty[i] as string;
      // A numbered step or a long sentence marks the start of instructions.
      if (/^\d+[.)]\s/.test(line) || line.split(/\s+/).length > 10) {
        splitAt = i;
        break;
      }
    }
    ingredientLines = nonEmpty.slice(0, splitAt);
    instructions = nonEmpty.slice(splitAt).join('\n') || null;
  }

  const serv = block.match(/serves\s+(\d+)|(\d+)\s+servings?/i);
  const servings = serv ? Number(serv[1] ?? serv[2]) : null;

  return { title, servings, instructions, ingredientLines };
}

/** Split a pasted block of multiple recipes (separated by a `---` line) and parse each. */
export function parseRecipesText(text: string): RecipeCandidate[] {
  return text
    .split(/\n\s*-{3,}\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => parseOneRecipe(b))
    .filter((r): r is RecipeCandidate => r !== null && r.ingredientLines.length > 0);
}
