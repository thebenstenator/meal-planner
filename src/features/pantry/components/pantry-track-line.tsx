import type { ShoppingItem } from '@/features/shopping-list/api';

/**
 * The "Added to pantry / Not added" line under a checked-off item, with a one-tap
 * switch that's remembered for that ingredient next time.
 *
 * Lives here rather than in a route because both list surfaces show it — the
 * quick list on /shopping-list and the full priced list on /shopping-list/$listId.
 * They apply the same `shouldTrackInPantry` decision when you check an item off,
 * so both have to be able to explain and reverse it; having it in one place is
 * what stops one screen from silently disagreeing with the other.
 *
 * Renders nothing until an item is checked (there's no outcome to report yet) or
 * when it has no canonical match (nothing the pantry could track).
 */
export function PantryTrackLine({
  item,
  tracked,
  onSetTracked,
}: {
  item: ShoppingItem;
  /** Whether checking this off put it in the pantry (pref, else the heuristic). */
  tracked: boolean;
  onSetTracked: (tracked: boolean) => void;
}) {
  if (!item.isChecked || !item.canonicalId) return null;

  return (
    // data-no-toggle: the row is tap-anywhere-to-check, and this control sits
    // inside it — without this a tap here would also uncheck the item.
    <div data-no-toggle className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <span className={tracked ? 'text-emerald-700' : 'text-muted-foreground'}>
        {tracked ? '✓ Added to pantry' : 'Not added to pantry'}
      </span>
      <button
        type="button"
        className="hover:bg-accent rounded border px-2 py-1 leading-none"
        title={`Remembered for ${item.displayName}`}
        aria-label={
          tracked
            ? `Don't track ${item.displayName} in the pantry`
            : `Track ${item.displayName} in the pantry`
        }
        onClick={() => onSetTracked(!tracked)}
      >
        {tracked ? 'Don’t track' : 'Track it'}
      </button>
    </div>
  );
}
