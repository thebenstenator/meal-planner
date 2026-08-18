const KEY = 'mealplan-last-list';

/**
 * The list tab you had open last, remembered across app launches.
 *
 * The URL is the real source of truth — `/shopping-list?list=<id>` is what
 * makes a reload land where you were. This covers the case the URL can't: a
 * cold start from the home-screen icon, or tapping "Shopping list" in the nav,
 * both of which arrive with no search param at all.
 *
 * Deliberately not keyed by household, and never cleared. The id is only ever
 * used if it's still among the lists on screen, so a deleted list or a
 * household you've since left falls back on its own — no bookkeeping needed at
 * either of those moments.
 */
export function readLastList(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    // Private mode, or storage disabled. Falling back to the first tab is fine.
    return null;
  }
}

export function writeLastList(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Same: remembering is a convenience, never a requirement.
  }
}
