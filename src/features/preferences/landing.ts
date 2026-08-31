/**
 * Per-person "start page" preference — where the app lands when you boot it up.
 * Stored on the device (localStorage), not in the shared household, so two people
 * in the same household can each have their own without conflict. Defaults to the
 * planner.
 *
 * Read from the router's `beforeLoad` (outside React), so this is a plain module,
 * not a hook or query.
 */

export const LANDING_OPTIONS = [
  { value: '/app', label: 'Home' },
  { value: '/planner', label: 'Plan' },
  { value: '/suggest', label: 'Ideas' },
  { value: '/recipes', label: 'Recipes' },
  { value: '/pantry', label: 'Pantry' },
  { value: '/shopping-list', label: 'List' },
] as const;

/** One of the primary routes — matches TanStack Router's typed `to`. */
export type LandingPath = (typeof LANDING_OPTIONS)[number]['value'];

const STORAGE_KEY = 'mealplan:landing';
const DEFAULT_LANDING: LandingPath = '/planner';

function isLandingPath(value: string | null): value is LandingPath {
  return value != null && LANDING_OPTIONS.some((o) => o.value === value);
}

/** The saved start page, or the default when none/invalid. Never throws. */
export function getLandingPref(): LandingPath {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLandingPath(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, SSR) — fall through to the default.
  }
  return DEFAULT_LANDING;
}

export function setLandingPref(value: LandingPath): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Best-effort; a failed write just means the default applies next boot.
  }
}
