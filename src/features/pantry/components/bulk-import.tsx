import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import type { PantryLocation } from '@/features/pantry/api';
import { parsePantryText, type PantryDraft } from '@/features/pantry/bulk-import';
import { usePantryMutations } from '@/features/pantry/use-pantry';

const LOCATIONS: PantryLocation[] = ['pantry', 'fridge', 'freezer'];

/**
 * Paste an inventory list (e.g. from a spreadsheet) and bulk-add it to the
 * pantry. Each line is parsed and matched to a canonical ingredient with the
 * engine + trigram matcher — no AI. Unmatched rows can be fixed inline; only
 * matched rows are added.
 */
export function PantryBulkImport({ householdId }: { householdId: string }) {
  const { add } = usePantryMutations();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [location, setLocation] = useState<PantryLocation>('pantry');
  const [rows, setRows] = useState<PantryDraft[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  async function preview() {
    if (text.trim() === '') return;
    setParsing(true);
    setAdded(null);
    try {
      setRows(await parsePantryText(householdId, text));
    } finally {
      setParsing(false);
    }
  }

  function update(i: number, patch: Partial<PantryDraft>) {
    setRows((rs) => rs?.map((r, j) => (j === i ? { ...r, ...patch } : r)) ?? null);
  }

  const matched = (rows ?? []).filter((r) => r.canonicalId);
  const unmatched = (rows ?? []).length - matched.length;

  async function addAll() {
    setAdding(true);
    try {
      for (const r of matched) {
        await add.mutateAsync({
          canonicalId: r.canonicalId as string,
          quantity: r.quantity ?? 0,
          unit: r.unit,
          location,
        });
      }
      setAdded(matched.length);
      setRows(null);
      setText('');
    } finally {
      setAdding(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-primary text-sm underline"
        onClick={() => setOpen(true)}
      >
        Bulk add from a list
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Bulk add from a list</span>
        <button
          type="button"
          className="text-muted-foreground text-xs underline"
          onClick={() => {
            setOpen(false);
            setRows(null);
          }}
        >
          Close
        </button>
      </div>

      {added != null && (
        <p className="text-sm text-emerald-700">Added {added} item{added === 1 ? '' : 's'}.</p>
      )}

      {!rows && (
        <>
          <Textarea
            aria-label="Paste your inventory"
            rows={6}
            placeholder={'Paste from your sheet, one item per line:\n2 cups flour\ncream cheese, 8 oz\neggs\t12\nbutter\t1\tlb'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            One item per line. Columns (name, quantity, unit) from a spreadsheet work too.
          </p>
          <Button type="button" onClick={preview} disabled={parsing || text.trim() === ''}>
            {parsing ? 'Reading…' : 'Preview'}
          </Button>
        </>
      )}

      {rows && (
        <>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>Add to</span>
            <select
              aria-label="Location for imported items"
              value={location}
              onChange={(e) => setLocation(e.target.value as PantryLocation)}
              className="border-input h-8 rounded-md border bg-transparent px-2 capitalize"
            >
              {LOCATIONS.map((l) => (
                <option key={l} value={l} className="capitalize">
                  {l}
                </option>
              ))}
            </select>
            <span>
              · {matched.length} matched{unmatched > 0 ? `, ${unmatched} need a match` : ''}
            </span>
          </div>

          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li key={i} className="space-y-1 rounded border p-2">
                <div className="text-muted-foreground truncate text-xs">{row.raw}</div>
                <div className="grid grid-cols-[1fr_4rem_4rem] gap-1">
                  <CanonicalCombobox
                    value={{ id: row.canonicalId, name: row.canonicalName }}
                    seedName={row.name}
                    onSelect={(id, name) => update(i, { canonicalId: id, canonicalName: name })}
                    placeholder="Match…"
                  />
                  <Input
                    aria-label={`Quantity for ${row.name}`}
                    inputMode="decimal"
                    value={row.quantity ?? ''}
                    onChange={(e) =>
                      update(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    placeholder="qty"
                    className="h-9"
                  />
                  <Input
                    aria-label={`Unit for ${row.name}`}
                    value={row.unit ?? ''}
                    onChange={(e) => update(i, { unit: e.target.value || null })}
                    placeholder="unit"
                    className="h-9"
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Button type="button" onClick={addAll} disabled={adding || matched.length === 0}>
              {adding ? 'Adding…' : `Add ${matched.length} item${matched.length === 1 ? '' : 's'}`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRows(null)}>
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
