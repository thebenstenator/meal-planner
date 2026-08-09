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
