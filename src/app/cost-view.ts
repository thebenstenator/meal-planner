/**
 * How recipe costs are shown: per serving, or for the whole dish (every
 * serving the recipe makes). A per-device preference, remembered locally.
 */
export type CostView = 'serving' | 'meal';

const KEY = 'cost-view';

export function getStoredCostView(): CostView {
  try {
    return localStorage.getItem(KEY) === 'meal' ? 'meal' : 'serving';
  } catch {
    return 'serving'; // storage blocked (private mode etc.) — just use the default
  }
}

export function storeCostView(view: CostView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Not remembered this time; the choice still applies for the session.
  }
}

/** The figure a cost view shows: per serving, or the whole dish (every serving). */
export function costForView(
  cost: { cents: number | null; perServingCents: number | null },
  view: CostView,
): number | null {
  return view === 'meal' ? cost.cents : cost.perServingCents;
}
