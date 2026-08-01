import {
  CASE_SENSITIVE_UNIT_ALIASES,
  UNIT_ALIASES,
  type Unit,
} from '@/lib/ingredients/units';

/**
 * Resolve a raw unit token to a canonical Unit, or null if unrecognized.
 * Tries the case-sensitive table first (so a capital "T" means tablespoon, not
 * teaspoon), then the lowercase alias table with trailing punctuation removed.
 */
export function resolveUnit(token: string): Unit | null {
  const trimmed = token.trim();
  if (trimmed.length === 0) return null;

  const caseHit = CASE_SENSITIVE_UNIT_ALIASES[trimmed];
  if (caseHit) return caseHit;

  const cleaned = trimmed.toLowerCase().replace(/\.+$/, '').replace(/\s+/g, ' ');
  return UNIT_ALIASES[cleaned] ?? null;
}

// Trailing prep descriptors that follow the ingredient name. Longest first so
// multi-word phrases match before their single-word prefixes.
const DESCRIPTOR_PHRASES: string[] = [
  'at room temperature',
  'room temperature',
  'plus more for serving',
  'plus more for dusting',
  'plus more',
  'cut into cubes',
  'cut into chunks',
  'thinly sliced',
  'finely chopped',
  'finely diced',
  'finely grated',
  'freshly grated',
  'freshly ground',
  'roughly chopped',
  'coarsely chopped',
  'lightly beaten',
  'well beaten',
  'softened',
  'melted',
  'divided',
  'chopped',
  'minced',
  'diced',
  'sliced',
  'grated',
  'shredded',
  'crushed',
  'ground',
  'toasted',
  'sifted',
  'packed',
  'drained',
  'rinsed',
  'cooked',
  'uncooked',
  'beaten',
  'peeled',
  'seeded',
  'cored',
  'pitted',
  'thawed',
  'trimmed',
  'halved',
  'quartered',
  'cubed',
  'crumbled',
  'juiced',
  'zested',
  'warmed',
  'chilled',
  'cold',
  'warm',
];

const LEADING_ARTICLE = /^(?:a|an|the)\s+/;

export interface CleanedName {
  name: string;
  descriptor: string | null;
}

/**
 * Clean an ingredient name: lowercase, strip a leading article, pull anything
 * after the first comma and any recognized trailing prep words into the
 * descriptor. Parentheticals are dropped from the name.
 */
export function cleanName(input: string): CleanedName {
  let s = input.trim().toLowerCase();
  const descriptors: string[] = [];

  // Everything after the first comma is conventionally a descriptor.
  const comma = s.indexOf(',');
  if (comma >= 0) {
    const tail = s.slice(comma + 1).trim();
    if (tail.length > 0) descriptors.push(tail);
    s = s.slice(0, comma);
  }

  // Drop parentheticals from the name (e.g. "(about 3)").
  s = s.replace(/\([^)]*\)/g, ' ');

  s = s.replace(LEADING_ARTICLE, '');
  s = s.replace(/\s+/g, ' ').trim();

  // Peel recognized descriptor phrases off the end, repeatedly.
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of DESCRIPTOR_PHRASES) {
      const re = new RegExp(`(?:^|\\s)${phrase}$`);
      if (re.test(s)) {
        descriptors.unshift(phrase);
        s = s.replace(re, '').trim();
        changed = true;
        break;
      }
    }
  }

  s = s.replace(/\s+/g, ' ').trim();

  return {
    name: s,
    descriptor: descriptors.length > 0 ? descriptors.join(', ') : null,
  };
}
