/**
 * Whether a click inside a shopping-list row landed on something that handles
 * its own clicks — the checkbox, the ⋮ menu, a price field, an open panel.
 *
 * Rows are tap-anywhere-to-check-off (you're holding a phone in one hand in a
 * store; a 16px checkbox is a bad target). That means every control inside a row
 * would otherwise flip the checkbox behind it. Panels opt out in bulk with
 * `data-no-toggle` instead of tagging each control, because their padding and
 * labels are dead space that shouldn't toggle either.
 */
export function isOwnClickTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest('button, a, input, select, textarea, label, [data-no-toggle]')
  );
}
