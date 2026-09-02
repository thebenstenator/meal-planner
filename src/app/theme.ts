/**
 * Theme (light / dark / system) persistence and application. Kept as a plain
 * module — not a hook — because the choice is applied to `<html>` outside React
 * (an inline boot script in index.html sets it before first paint to avoid a
 * flash), and the store/provider just keep it in sync afterwards.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mealplan:theme';

/** theme-color meta values — should track --background in each mode. */
const META_LIGHT = '#f7f9f9';
const META_DARK = '#0f1516';

export function getStoredTheme(): Theme {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage unavailable — fall through to the default.
  }
  return 'system';
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Best-effort.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Whether a given theme resolves to dark right now. */
export function resolvesDark(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark());
}

/** Toggle the `dark` class on <html> and keep the theme-color meta in step. */
export function applyTheme(theme: Theme): void {
  const dark = resolvesDark(theme);
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? META_DARK : META_LIGHT);
}
