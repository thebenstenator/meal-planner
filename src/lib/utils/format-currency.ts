/**
 * The single money-formatting helper (see 10-conventions.md).
 *
 * All money in this app is stored and passed around as integer cents — never
 * floats, never dollar `number`s. Formatting to a human-readable string happens
 * ONLY here, at the display layer.
 */
export function formatCurrency(
  cents: number,
  { currency = 'USD', locale = 'en-US' }: { currency?: string; locale?: string } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
