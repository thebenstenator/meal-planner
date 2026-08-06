/** Trim a number to at most 2 decimals, dropping trailing zeros (3 -> "3", 1.5 -> "1.5"). */
function trimNum(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * The scaled amount of one ingredient when a recipe is resized from `base`
 * servings to `target`, e.g. "3 cups". Returns null for no-quantity lines
 * ("to taste") or a non-positive base, which the UI leaves unscaled.
 */
export function scaledAmount(
  quantity: number | null,
  unit: string | null,
  base: number,
  target: number,
): string | null {
  if (quantity == null || base <= 0) return null;
  const scaled = quantity * (target / base);
  return `${trimNum(scaled)}${unit ? ` ${unit}` : ''}`;
}
