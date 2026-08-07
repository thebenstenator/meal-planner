import { matchCanonical } from '@/features/ingredients/api';
import { parse } from '@/lib/ingredients';

export interface PantryDraft {
  raw: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  canonicalId: string | null;
  canonicalName: string | null;
}

/**
 * Parse one pasted inventory line into a name + quantity + unit — no AI.
 * Handles a spreadsheet paste (tab- or comma-separated columns: name, qty, unit)
 * and a plain ingredient line ("2 cups flour"). For column rows the first cell
 * is the name and the rest is parsed as a quantity+unit fragment.
 */
export function parsePantryLine(line: string): {
  name: string;
  quantity: number | null;
  unit: string | null;
} {
  if (line.includes('\t') || line.includes(',')) {
    const cells = line
      .split(/[\t,]/)
      .map((c) => c.trim())
      .filter(Boolean);
    const name = cells[0] ?? '';
    const rest = cells.slice(1).join(' ');
    const parsed = rest ? parse(rest) : null;
    return { name, quantity: parsed?.quantity ?? null, unit: parsed?.unit ?? null };
  }
  const parsed = parse(line);
  return { name: parsed.name || line, quantity: parsed.quantity, unit: parsed.unit };
}

/** Parse a pasted block into pantry drafts, matching each name to a canonical ingredient. */
export async function parsePantryText(householdId: string, text: string): Promise<PantryDraft[]> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return Promise.all(
    lines.map(async (raw) => {
      const { name, quantity, unit } = parsePantryLine(raw);
      const match = name ? await matchCanonical(householdId, name).catch(() => null) : null;
      return {
        raw,
        name,
        quantity,
        unit,
        canonicalId: match?.canonicalIngredientId ?? null,
        canonicalName: match?.name ?? null,
      };
    }),
  );
}
