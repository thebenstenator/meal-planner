import type { ReactNode } from 'react';

/**
 * A working-on-it label: the text, then three dots that pulse in turn —
 * `<Loading>Reading recipe</Loading>` in place of the static "Reading recipe…".
 * Screen readers get a plain "…" instead of the animated dots.
 */
export function Loading({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline">
      {children}
      <span aria-hidden="true" className="loading-dots">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
      <span className="sr-only">…</span>
    </span>
  );
}
