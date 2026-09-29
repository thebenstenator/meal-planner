// Ingredient sections: recipes like "Lemon curd" + "Lemon cookies" group their
// ingredients under headings. A section isn't its own record — each ingredient
// carries its section's name, and a run of consecutive rows with the same name
// is one section (see the recipe_ingredient.section migration).

const MAX_HEADING_WORDS = 7;
const MAX_HEADING_CHARS = 60;

/** Starts like an amount ("2 cups", "½ tsp", "1-2") — never a heading. */
const LEADING_AMOUNT = /^[\d¼½¾⅓⅔⅛⅜⅝⅞]/;

function tidy(name: string): string {
  const n = name.replace(/\s+/g, ' ').trim();
  // SHOUTED headings ("LEMON CURD") read better in sentence case.
  const shouted = n === n.toUpperCase() && /[A-Z]/.test(n);
  const base = shouted ? n.toLowerCase() : n;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * If a pasted/imported line is a section heading rather than an ingredient,
 * return the section's name; otherwise null. Recognises the common shapes:
 * "Lemon curd:", "For the frosting", "## Filling", "**Sauce**", "LEMON CURD".
 * Conservative on purpose — a real ingredient mistaken for a heading would
 * vanish from the list, which is worse than a heading left as a row.
 */
export function sectionHeading(line: string): string | null {
  let s = line.trim();
  if (s === '') return null;

  let marked = false;
  // Markdown heading or bold wrapper.
  if (/^#{1,6}\s*/.test(s)) {
    s = s.replace(/^#{1,6}\s*/, '');
    marked = true;
  }
  const bold = /^(\*\*|__)(.+)\1:?$/.exec(s);
  if (bold?.[2]) {
    s = bold[2];
    marked = true;
  }

  const colon = s.endsWith(':');
  if (colon) s = s.slice(0, -1).trim();
  if (s === '' || LEADING_AMOUNT.test(s)) return null;
  // A colon mid-line ("Garnish: parsley") is an ingredient with a label.
  if (s.includes(':')) return null;

  const words = s.split(/\s+/).length;
  if (words > MAX_HEADING_WORDS || s.length > MAX_HEADING_CHARS) return null;

  const forThe = /^for (the )?[a-z]/i.test(s) && !/\d/.test(s);
  const shouted = s === s.toUpperCase() && /[A-Z]{3}/.test(s) && !/\d/.test(s);

  if (marked || colon || forThe || shouted) return tidy(s);
  return null;
}

/**
 * Split raw lines into ingredient lines, each tagged with the heading above it
 * (null before any heading). Heading lines themselves are dropped. Blank lines
 * are skipped but don't end a section — sites often space groups apart.
 */
export function assignSections(
  lines: string[],
): Array<{ line: string; section: string | null }> {
  const out: Array<{ line: string; section: string | null }> = [];
  let current: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    const heading = sectionHeading(line);
    if (heading !== null) {
      current = heading;
      continue;
    }
    out.push({ line, section: current });
  }
  return out;
}

/**
 * Group ordered rows into sections for display: each run of consecutive rows
 * sharing a section becomes one group. `index` is the row's position in the
 * original array, so callers can still address it.
 */
export function groupBySection<T extends { section?: string | null }>(
  rows: T[],
): Array<{ section: string | null; items: Array<{ row: T; index: number }> }> {
  const groups: Array<{
    section: string | null;
    items: Array<{ row: T; index: number }>;
  }> = [];
  rows.forEach((row, index) => {
    const section = row.section?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.items.push({ row, index });
    else groups.push({ section, items: [{ row, index }] });
  });
  return groups;
}

/** True when a recipe actually uses sections (any row has one). */
export function hasSections(rows: Array<{ section?: string | null }>): boolean {
  return rows.some((r) => !!r.section?.trim());
}
