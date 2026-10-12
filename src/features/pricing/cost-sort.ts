/** What sorting needs to know about a recipe's cost (see EntryCost). */
export interface SortableCost {
  perServingCents: number | null;
  /** Some ingredients couldn't be priced, so the figure is a floor. */
  unpriced: boolean;
}

/**
 * Cheapest per serving first, in three tiers: fully priced recipes, then
 * partly priced ones (their cost is a floor — ranking them among the fully
 * priced would put a half-priced recipe first just for missing prices), then
 * unpriced ones A–Z. Stable by title within a cost, so the order doesn't jump.
 */
export function sortByCost<T extends { id: string; title: string }>(
  recipes: T[],
  costOf: (id: string) => SortableCost | undefined,
): T[] {
  const tier = (c: SortableCost | undefined) =>
    c?.perServingCents == null ? 2 : c.unpriced ? 1 : 0;
  return [...recipes].sort((a, b) => {
    const ca = costOf(a.id);
    const cb = costOf(b.id);
    const t = tier(ca) - tier(cb);
    if (t !== 0) return t;
    const d = (ca?.perServingCents ?? 0) - (cb?.perServingCents ?? 0);
    return d !== 0 ? d : a.title.localeCompare(b.title);
  });
}
