// Postgres `text` cannot store a NUL byte — it errors 22P05. Extracted PDF text
// (and occasionally other sources) carries NULs and other control characters, so
// strip them before anything reaches the database.
//
// Built from escape sequences (not literal control chars) so this source stays
// pure ASCII. Removes C0/C1 control chars except tab, newline, and carriage
// return, which are kept as normal whitespace.
// Matching control chars is the whole point here.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]', 'g');

export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHARS, '');
}

// Decorative / unrenderable glyphs PDF extraction leaves behind: the replacement
// char (U+FFFD), private-use symbols (U+E000–F8FF, where symbol fonts map their
// icons), geometric-shape "boxes" (U+25A0–25FF), and decorative bullets. It does
// NOT touch fractions (½ ⅓), the degree sign, or emoji — those are meaningful.
const DECORATIVE_GLYPHS = new RegExp(
  '[\\uFFFD\\uE000-\\uF8FF\\u25A0-\\u25FF\\u2022\\u2023\\u2043\\u2219]',
  'gu',
);

export function stripDecorativeGlyphs(input: string): string {
  return input.replace(DECORATIVE_GLYPHS, '');
}

/**
 * Clean text coming from an import (paste / file / PDF): drop DB-breaking control
 * bytes and decorative glyphs, collapse the runs of spaces that removals leave
 * behind, and trim. Newlines are preserved (for multi-line instructions).
 */
export function cleanImportedText(input: string): string {
  return stripDecorativeGlyphs(stripControlChars(input))
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+\n/g, '\n')
    .trim();
}
