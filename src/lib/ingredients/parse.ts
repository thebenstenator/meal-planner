import { convert } from '@/lib/ingredients/convert';
import { cleanName, resolveUnit } from '@/lib/ingredients/normalize';
import type { ParsedIngredient } from '@/lib/ingredients/types';
import { CONTAINER_UNITS, type Unit } from '@/lib/ingredients/units';

// ---------------------------------------------------------------------------
// Numeric parsing
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
};

/** Replace unicode fractions, splitting "1½" into "1 1/2". */
function preprocessFractions(input: string): string {
  let s = input;
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(new RegExp(`(\\d)${glyph}`, 'g'), `$1 ${ascii}`);
    s = s.replace(new RegExp(glyph, 'g'), ascii);
  }
  return s;
}

interface NumberParse {
  value: number;
  rest: string;
  /** Penalty applied to overall confidence for how the number was read. */
  confidence: number;
}

/** Parse a leading numeric expression (word, range, mixed, fraction, decimal). */
function parseNumber(input: string): NumberParse | null {
  const s = input.trimStart();

  // Word number ("a", "two", "a dozen").
  const word = /^([a-z]+)\b/i.exec(s);
  if (word && word[1]) {
    const lower = word[1].toLowerCase();
    if (lower in WORD_NUMBERS) {
      const value = WORD_NUMBERS[lower] as number;
      // "a"/"an" are weaker signals than a spelled-out digit.
      const confidence = lower === 'a' || lower === 'an' ? 0.9 : 0.95;
      return { value, rest: s.slice(word[0].length), confidence };
    }
  }

  // Range: take the upper bound (specs/05).
  const range = /^(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/.exec(s);
  if (range && range[2]) {
    return { value: Number(range[2]), rest: s.slice(range[0].length), confidence: 0.95 };
  }

  // Mixed number "1 1/2".
  const mixed = /^(\d+)\s+(\d+)\/(\d+)/.exec(s);
  if (mixed && mixed[1] && mixed[2] && mixed[3]) {
    const value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return { value, rest: s.slice(mixed[0].length), confidence: 1 };
  }

  // Simple fraction "1/2".
  const frac = /^(\d+)\/(\d+)/.exec(s);
  if (frac && frac[1] && frac[2]) {
    return { value: Number(frac[1]) / Number(frac[2]), rest: s.slice(frac[0].length), confidence: 1 };
  }

  // Decimal or integer.
  const dec = /^(\d+(?:\.\d+)?)/.exec(s);
  if (dec && dec[1]) {
    return { value: Number(dec[1]), rest: s.slice(dec[0].length), confidence: 1 };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Measure parsing (quantity + optional parenthetical + optional unit)
// ---------------------------------------------------------------------------

interface Measure {
  quantity: number;
  unit: Unit | null;
  paren: { quantity: number; unit: Unit } | null;
  confidence: number;
}

/** Pull a unit token (2-word like "fl oz" first) off the front of `s`. */
function takeUnit(s: string): { unit: Unit | null; rest: string } {
  const trimmed = s.trimStart();
  const tokens = trimmed.split(/\s+/);
  const first = tokens[0] ?? '';
  const second = tokens[1];

  if (first && second) {
    const twoWord = resolveUnit(`${first} ${second}`);
    if (twoWord) {
      return { unit: twoWord, rest: tokens.slice(2).join(' ') };
    }
  }
  if (first) {
    const oneWord = resolveUnit(first);
    if (oneWord) {
      return { unit: oneWord, rest: tokens.slice(1).join(' ') };
    }
  }
  return { unit: null, rest: trimmed };
}

/** Parse "8 oz" style content inside a parenthetical. */
function parseParenMeasure(inner: string): { quantity: number; unit: Unit } | null {
  const num = parseNumber(inner);
  if (!num) return null;
  const { unit } = takeUnit(num.rest);
  if (!unit) return null;
  return { quantity: num.value, unit };
}

/** Parse one measure starting at a number. Returns null if no leading number. */
function parseOneMeasure(input: string): { measure: Measure; rest: string } | null {
  const num = parseNumber(input);
  if (!num) return null;

  let rest = num.rest.trimStart();
  let paren: Measure['paren'] = null;
  let confidence = num.confidence;

  if (rest.startsWith('(')) {
    const close = rest.indexOf(')');
    if (close > 0) {
      const inner = rest.slice(1, close).trim();
      const parsed = parseParenMeasure(inner);
      if (parsed) {
        paren = parsed;
        confidence *= 0.97;
      }
      rest = rest.slice(close + 1).trimStart();
    }
  }

  const { unit, rest: afterUnit } = takeUnit(rest);
  let tail = afterUnit;

  // A parenthetical can also follow the unit: "1 package (16 oz) frozen peas".
  if (paren === null && tail.trimStart().startsWith('(')) {
    const t = tail.trimStart();
    const close = t.indexOf(')');
    if (close > 0) {
      const parsed = parseParenMeasure(t.slice(1, close).trim());
      if (parsed) {
        paren = parsed;
        confidence *= 0.97;
      }
      tail = t.slice(close + 1).trimStart();
    }
  }

  return {
    measure: { quantity: num.value, unit, paren, confidence },
    rest: tail,
  };
}

/** Resolve a measure's effective (quantity, unit), applying container parens. */
function effectiveMeasure(m: Measure): { quantity: number; unit: Unit | null } {
  if (m.paren) {
    // "1 (8 oz) package" -> 8 oz; "2 (14 oz) cans" -> 28 oz.
    if (m.unit === null || CONTAINER_UNITS.has(m.unit)) {
      return { quantity: m.quantity * m.paren.quantity, unit: m.paren.unit };
    }
  }
  return { quantity: m.quantity, unit: m.unit };
}

// ---------------------------------------------------------------------------
// Top-level parse
// ---------------------------------------------------------------------------

const VAGUE_PHRASES = /\b(to taste|as needed|as desired|for serving|for garnish|for dusting|for frying)\b/i;

/** Parse a single raw ingredient line into a structured ParsedIngredient. */
export function parse(raw: string): ParsedIngredient {
  const original = raw;
  let s = raw.replace(/\s+/g, ' ').trim();

  // Optional markers.
  let isOptional = false;
  if (/\boptional\b/i.test(s) || /\(\s*optional\s*\)/i.test(s)) {
    isOptional = true;
    s = s.replace(/\(?\s*optional\s*\)?/gi, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/,\s*$/, '').trim();
  }

  s = preprocessFractions(s);

  // Collect one or more "+"-joined measures.
  const measures: Measure[] = [];
  let rest = s;
  let cursor = s;
  while (true) {
    const parsed = parseOneMeasure(cursor);
    if (!parsed) break;
    measures.push(parsed.measure);
    rest = parsed.rest;
    const next = parsed.rest.trimStart();
    if (next.startsWith('+')) {
      cursor = next.slice(1).trimStart();
      continue;
    }
    break;
  }

  // No quantity at all.
  if (measures.length === 0) {
    const vague = VAGUE_PHRASES.test(s);
    const cleaned = cleanName(stripLeadingOf(s.replace(VAGUE_PHRASES, ' ')));
    return {
      raw: original,
      quantity: null,
      unit: vague ? 'to_taste' : null,
      name: firstOption(cleaned.name),
      descriptor: cleaned.descriptor,
      isOptional,
      confidence: vague ? 0.9 : 0.4,
    };
  }

  // Combine measures into a single (quantity, unit).
  const effectives = measures.map(effectiveMeasure);
  const firstEff = effectives[0] as { quantity: number; unit: Unit | null };
  let quantity = firstEff.quantity;
  let unit = firstEff.unit;
  let confidence = measures.reduce((acc, m) => Math.min(acc, m.confidence), 1);

  if (effectives.length > 1) {
    confidence *= 0.9;
    const targetUnit = unit;
    if (targetUnit) {
      for (let i = 1; i < effectives.length; i++) {
        const e = effectives[i];
        if (!e) continue;
        if (e.unit) {
          const r = convert(e.quantity, e.unit, targetUnit);
          if (r.ok) {
            quantity += r.quantity;
          } else {
            confidence *= 0.8; // couldn't fold this addend in; keep the first
          }
        }
      }
    }
  }

  // A quantity with no recognized unit is a count of items ("3 eggs").
  if (unit === null) {
    unit = 'each';
    confidence *= 0.95;
  }

  const cleaned = cleanName(stripLeadingOf(rest));
  // If cleaning left no name, fall back to the raw remainder.
  const name = cleaned.name.length > 0 ? cleaned.name : rest.trim().toLowerCase();

  return {
    raw: original,
    quantity,
    unit,
    name: firstOption(name),
    descriptor: cleaned.descriptor,
    isOptional,
    confidence: Number(confidence.toFixed(4)),
  };
}

function stripLeadingOf(s: string): string {
  return s.replace(/^\s*of\s+/i, '').trim();
}

/**
 * Recipes often bake a substitution into one line ("molasses or dark honey").
 * Keep the first option as the ingredient we match/price on; the full text still
 * lives in `raw` so the substitution stays visible to the cook.
 */
function firstOption(name: string): string {
  const primary = name.split(/\s+or\s+/i)[0]?.trim();
  return primary && primary.length > 0 ? primary : name;
}

/** Parse many lines at once. */
export function parseLines(lines: string[]): ParsedIngredient[] {
  return lines.map(parse);
}
