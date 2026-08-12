import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export interface RowMenuAction {
  label: string;
  onSelect: () => void;
  /** Styles the item as dangerous (delete). */
  destructive?: boolean;
}

/**
 * The "⋮" overflow menu on a list row. Row actions pile up over time — remove,
 * change category, edit quantity — and spelling them all out inline turns every
 * row into a wall of tiny links, which is especially bad on a phone. This keeps
 * one tap target per row and puts the actions behind it.
 *
 * Hand-rolled to match the combobox popup idiom rather than pulling in a menu
 * dependency: absolutely positioned, closes on outside pointerdown or Escape.
 */
export function RowMenu({ label, actions }: { label: string; actions: RowMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded px-2 py-1 text-lg leading-none"
      >
        ⋮
      </button>
      {open && (
        <div
          role="menu"
          className="bg-popover absolute right-0 z-20 mt-1 min-w-40 rounded-md border p-1 shadow-md"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              className={cn(
                'hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm',
                action.destructive && 'text-destructive',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
