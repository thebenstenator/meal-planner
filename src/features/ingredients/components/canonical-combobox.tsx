import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCanonicalList, useCreateCanonical } from '@/features/ingredients/use-ingredients';

interface Props {
  value: { id: string | null; name: string | null };
  /** When there's no matched canonical yet, pre-fill the box with this parsed
   * name so searching / "Create" is one tap instead of re-typing. */
  seedName?: string | null;
  onSelect: (id: string | null, name: string | null) => void;
  placeholder?: string;
}

/**
 * Type-ahead picker over canonical ingredients (global + household). Selecting a
 * result sets the canonical id; a "Create" option adds a household ingredient
 * on the fly. Used by the recipe ingredient editor.
 */
export function CanonicalCombobox({ value, seedName, onSelect, placeholder }: Props) {
  const [text, setText] = useState(value.name ?? seedName ?? '');
  const [open, setOpen] = useState(false);
  const { data } = useCanonicalList(open ? text : '');
  const create = useCreateCanonical();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reflect external changes (e.g. after parsing a pasted block): show the
  // matched name, or fall back to the parsed name for unmatched rows.
  useEffect(() => {
    setText(value.name ?? seedName ?? '');
  }, [value.name, seedName]);

  const results = (data ?? []).slice(0, 8);
  const trimmed = text.trim();
  const showCreate =
    trimmed.length > 0 && !results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="relative">
      <Input
        value={text}
        placeholder={placeholder ?? 'Search ingredient…'}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        className={value.id ? '' : 'border-amber-400'}
      />
      {open && (results.length > 0 || showCreate) && (
        <ul className="bg-popover absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border p-1 shadow-md">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(r.id, r.name);
                  setText(r.name);
                  setOpen(false);
                }}
              >
                <span>{r.name}</span>
                <Badge variant={r.isGlobal ? 'outline' : 'secondary'}>
                  {r.isGlobal ? 'global' : 'yours'}
                </Badge>
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                className="hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  create.mutate(
                    {
                      name: trimmed,
                      aliases: [],
                      category: null,
                      defaultUnit: null,
                      densityGPerMl: null,
                      unitSizeQuantity: null,
                      unitSizeUnit: null,
                      countToGram: null,
                    },
                    {
                      onSuccess: (id) => {
                        onSelect(id, trimmed);
                        setText(trimmed);
                        setOpen(false);
                      },
                    },
                  );
                }}
              >
                {create.isPending ? 'Creating…' : `Create “${trimmed}”`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
