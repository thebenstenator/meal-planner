import { useRef, useState } from 'react';

import { parseQuantity } from '@/lib/ingredients';
import { cn } from '@/lib/utils/cn';

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * The "how many?" box on a list row — optional, so it sits empty until someone
 * types a number. Saves on blur or Enter; clearing it clears the quantity. The
 * unit (if the item has one) stays as-is and shows after the box, so "2" on a
 * recipe line still means "2 cup". Accepts fractions ("1/2", "1½") like the
 * recipe editor.
 *
 * Only holds its own text while focused; otherwise it shows the item's value, so
 * an edit from someone else's phone shows up without a stale draft in the way.
 */
export function QuantityBox({
  itemName,
  quantity,
  unit,
  onSave,
  className,
}: {
  itemName: string;
  quantity: number | null;
  unit: string | null;
  onSave: (quantity: number | null) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const shown = quantity != null ? trim(quantity) : '';

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = text === '' ? null : parseQuantity(text);
    // Unreadable input: drop it and keep what was there.
    if (text !== '' && (next == null || next <= 0)) return;
    if (next === quantity) return;
    onSave(next);
  }

  return (
    <span data-no-toggle className={cn('inline-flex shrink-0 items-center gap-1', className)}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`How many ${itemName}`}
        placeholder="qty"
        value={draft ?? shown}
        onFocus={(e) => {
          setDraft(shown);
          e.target.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            // Skip the commit the blur would otherwise do.
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className="border-input bg-background placeholder:text-muted-foreground/60 h-8 w-12 rounded-md border px-1.5 text-center text-sm"
      />
      {unit && <span className="text-muted-foreground text-xs">{unit}</span>}
    </span>
  );
}
