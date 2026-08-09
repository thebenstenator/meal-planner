import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { guessCategory } from '@/features/ingredients/guess-category';
import { useCreateCanonical } from '@/features/ingredients/use-ingredients';
import type { PantryLocation } from '@/features/pantry/api';
import { parsePantryText, type PantryDraft } from '@/features/pantry/bulk-import';
import { usePantryMutations } from '@/features/pantry/use-pantry';

const LOCATIONS: PantryLocation[] = ['pantry', 'fridge', 'freezer'];

/**
 * Paste an inventory list (e.g. from a spreadsheet) and bulk-add it to the
 * pantry. Each line is parsed and matched to a canonical ingredient with the
 * engine + trigram matcher — no AI. Rows that don't match an existing ingredient
 * are added as a new household ingredient (using the parsed name) unless you pick
 * an existing one instead.
 */
export function PantryBulkImport({
  householdId,
  onClose,
}: {
  householdId: string;
  onClose?: () => void;
}) {
  const { add } = usePantryMutations();
  const createCanonical = useCreateCanonical();
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

  // A row is addable as long as it has a name to add under — matched rows use
  // their canonical, unmatched rows get one created from the parsed name.
  const addable = (rows ?? []).filter((r) => r.name.trim() !== '');
  const willCreate = addable.filter((r) => !r.canonicalId);
  const skipped = (rows ?? []).length - addable.length;

  async function addAll() {
    setAdding(true);
    try {
      for (const r of addable) {
        const canonicalId =
          r.canonicalId ??
          (await createCanonical.mutateAsync({
            name: r.name.trim(),
            aliases: [],
            category: guessCategory(r.name),
            defaultUnit: null,
            densityGPerMl: null,
            unitSizeQuantity: null,
            unitSizeUnit: null,
            countToGram: null,
          }));
        await add.mutateAsync({
          canonicalId,
          quantity: r.quantity ?? 0,
          amountUnknown: r.quantity == null,
          unit: r.unit,
          location,
        });
      }
      setAdded(addable.length);
      setRows(null);
      setText('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Bulk add from a list</span>
        <button
          type="button"
          className="text-muted-foreground text-xs underline"
          onClick={() => {
            setRows(null);
            onClose?.();
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
              · {addable.length - willCreate.length} matched
              {willCreate.length > 0 ? `, ${willCreate.length} added as new` : ''}
              {skipped > 0 ? `, ${skipped} skipped` : ''}
            </span>
          </div>

          {willCreate.length > 0 && (
            <p className="text-xs text-amber-700">
              Highlighted rows will be added as new ingredients. Pick an existing one instead if you
              want to avoid a duplicate.
            </p>
          )}

          <ul className="space-y-2">
            {rows.map((row, i) => {
              const willCreateRow = !row.canonicalId && row.name.trim() !== '';
              const noName = row.name.trim() === '' && !row.canonicalId;
              return (
              <li
                key={i}
                className={
                  willCreateRow
                    ? 'space-y-1 rounded border border-amber-400 bg-amber-50 p-2'
                    : 'space-y-1 rounded border p-2'
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate text-xs">{row.raw}</span>
                  {row.canonicalId ? (
                    <span className="shrink-0 text-[10px] font-medium text-emerald-700">
                      ✓ {row.canonicalName}
                    </span>
                  ) : noName ? (
                    <span className="text-muted-foreground shrink-0 text-[10px] font-medium">
                      skipped
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                      new
                    </span>
                  )}
                </div>
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
              );
            })}
          </ul>

          <div className="flex gap-2">
            <Button type="button" onClick={addAll} disabled={adding || addable.length === 0}>
              {adding ? 'Adding…' : `Add ${addable.length} item${addable.length === 1 ? '' : 's'}`}
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
