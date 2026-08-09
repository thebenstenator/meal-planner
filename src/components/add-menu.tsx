import { useState } from 'react';

import { Button } from '@/components/ui/button';

export interface AddMethod {
  label: string;
  description?: string;
  icon?: string;
  onSelect: () => void;
}

/**
 * One "Add …" button that opens a small sheet of methods — so a page has a
 * single entry point instead of a row of buttons per import method. Selecting a
 * method runs its action (navigate to a flow, reveal an inline form, etc.).
 */
export function AddMenu({
  label,
  methods,
  size,
}: {
  label: string;
  methods: AddMethod[];
  size?: 'sm' | 'default';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>

      {open && (
        <>
          {/* Backdrop closes the menu on any outside tap. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="bg-popover absolute right-0 z-20 mt-1 w-64 rounded-md border p-1 shadow-md"
          >
            {methods.map((m) => (
              <button
                key={m.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  m.onSelect();
                }}
                className="hover:bg-accent flex w-full items-start gap-2.5 rounded px-2 py-2 text-left"
              >
                {m.icon && <span className="text-base leading-none">{m.icon}</span>}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{m.label}</span>
                  {m.description && (
                    <span className="text-muted-foreground block text-xs">{m.description}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
