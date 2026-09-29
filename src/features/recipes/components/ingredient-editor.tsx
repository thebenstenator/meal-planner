import { Fragment, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import type { RecipeIngredientDraft } from '@/features/recipes/api';
import { parseIngredientBlock } from '@/features/recipes/parse-block';
import { groupBySection, hasSections } from '@/features/recipes/sections';
import { parse, parseQuantity } from '@/lib/ingredients';

interface Props {
  householdId: string;
  value: RecipeIngredientDraft[];
  onChange: (rows: RecipeIngredientDraft[]) => void;
  /** Show the "paste a block" box. Off on import review, where rows already exist. */
  showPaste?: boolean;
}

const EMPTY_ROW: RecipeIngredientDraft = {
  rawText: '',
  quantity: null,
  unit: null,
  canonicalId: null,
  canonicalName: null,
  descriptor: null,
  isOptional: false,
  parseConfidence: null,
  needsReview: false,
  section: null,
};

export function IngredientEditor({ householdId, value, onChange, showPaste = true }: Props) {
  const [block, setBlock] = useState('');
  const [parsing, setParsing] = useState(false);

  function update(index: number, patch: Partial<RecipeIngredientDraft>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const sectioned = hasSections(value);
  // Where each section's run of rows starts (→ its rows' indexes) and ends, so
  // the list can draw a heading above it and a "+ row" button below it.
  const groupStarts = new Map<number, number[]>();
  const groupEnds = new Set<number>();
  for (const group of groupBySection(value)) {
    const indexes = group.items.map((it) => it.index);
    groupStarts.set(indexes[0] ?? 0, indexes);
    groupEnds.add(indexes[indexes.length - 1] ?? 0);
  }
  const sectionNames = [
    ...new Set(value.map((r) => r.section?.trim()).filter((s): s is string => !!s)),
  ];

  /** Rename one section (a run of rows), or clear it to drop the heading. */
  function renameSection(indexes: number[], name: string) {
    const section = name.trim() || null;
    onChange(value.map((row, i) => (indexes.includes(i) ? { ...row, section } : row)));
  }
  /** Add a blank row at the end of a section. */
  function addRowAfter(index: number, section: string | null) {
    const next = [...value];
    next.splice(index + 1, 0, { ...EMPTY_ROW, section });
    onChange(next);
  }
  /** Move a row to the end of another section (or the unsectioned top). */
  function moveToSection(index: number, section: string | null) {
    const row = value[index];
    if (!row) return;
    const rest = value.filter((_, i) => i !== index);
    let at = 0;
    if (section !== null) {
      const last = rest.map((r) => r.section?.trim() || null).lastIndexOf(section);
      at = last === -1 ? rest.length : last + 1;
    }
    rest.splice(at, 0, { ...row, section });
    onChange(rest);
  }
  function addSection() {
    let name = 'New section';
    for (let n = 2; sectionNames.includes(name); n++) name = `New section ${n}`;
    onChange([...value, { ...EMPTY_ROW, section: name }]);
  }

  async function parseBlock() {
    if (block.trim().length === 0) return;
    setParsing(true);
    try {
      const drafts = await parseIngredientBlock(householdId, block);
      onChange([...value, ...drafts]);
      setBlock('');
    } finally {
      setParsing(false);
    }
  }

  const reviewCount = value.filter((r) => r.needsReview || !r.canonicalId).length;

  return (
    <div className="space-y-4">
      {showPaste && (
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="paste-block">Paste ingredients</Label>
          <Textarea
            id="paste-block"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            placeholder={'2 cups flour\n1 (8 oz) package cream cheese, softened\n3 large eggs'}
            rows={4}
          />
          <Button type="button" onClick={parseBlock} disabled={parsing || block.trim().length === 0}>
            {parsing ? 'Adding…' : 'Add rows'}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Ingredients ({value.length})
          {reviewCount > 0 && (
            <span className="text-muted-foreground font-normal"> · {reviewCount} to review</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={addSection}>
            Add section
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // A new row continues whatever section the list ends in.
            onClick={() =>
              onChange([
                ...value,
                { ...EMPTY_ROW, section: value[value.length - 1]?.section ?? null },
              ])
            }
          >
            Add row
          </Button>
        </div>
      </div>

      {value.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {showPaste ? 'Paste a block above, or add rows one at a time.' : 'Add rows one at a time.'}
        </p>
      )}

      <ul className="space-y-3">
        {value.map((row, i) => (
          <Fragment key={i}>
            {sectioned && groupStarts.has(i) && (
              <li className="pt-2">
                {row.section?.trim() ? (
                  <SectionNameInput
                    value={row.section.trim()}
                    onCommit={(name) => renameSection(groupStarts.get(i) ?? [i], name)}
                  />
                ) : (
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    No section
                  </p>
                )}
              </li>
            )}
            <li className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <RawTextInput
                  label={`Ingredient ${i + 1} text`}
                  value={row.rawText}
                  onChange={(text) => update(i, { rawText: text })}
                  // Edit the line, and the amount/unit follow it: "½ cup" → "¼ cup"
                  // re-reads to 0.25. Only fires when the text actually changed, so
                  // it never clobbers a quantity you set by hand.
                  onReparse={(text) => {
                    const p = parse(text);
                    update(i, { quantity: p.quantity, unit: p.unit, parsedName: p.name || null });
                  }}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
                <CanonicalCombobox
                  value={{ id: row.canonicalId, name: row.canonicalName }}
                  seedName={row.parsedName}
                  onSelect={(id, name) =>
                    update(i, { canonicalId: id, canonicalName: name, needsReview: id === null })
                  }
                  placeholder="Match to ingredient…"
                />
                <QuantityInput
                  label={`Ingredient ${i + 1} quantity`}
                  value={row.quantity}
                  onCommit={(q) => update(i, { quantity: q })}
                />
                <Input
                  aria-label={`Ingredient ${i + 1} unit`}
                  value={row.unit ?? ''}
                  onChange={(e) => update(i, { unit: e.target.value || null })}
                  placeholder="unit"
                />
              </div>

              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.isOptional}
                    onChange={(e) => update(i, { isOptional: e.target.checked })}
                  />
                  Optional
                </label>
                {sectioned && (
                  <select
                    aria-label={`Ingredient ${i + 1} section`}
                    value={row.section?.trim() || ''}
                    onChange={(e) => moveToSection(i, e.target.value || null)}
                    className="border-input bg-background h-8 max-w-40 rounded-md border px-2 text-xs"
                  >
                    <option value="">No section</option>
                    {sectionNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
                {!row.canonicalId ? (
                  <Badge variant="outline" className="text-amber-600">
                    needs match
                  </Badge>
                ) : (
                  row.needsReview && (
                    <Badge variant="outline" className="text-amber-600">
                      review
                    </Badge>
                  )
                )}
              </div>
            </li>
            {sectioned && groupEnds.has(i) && row.section?.trim() && (
              <li>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addRowAfter(i, row.section?.trim() ?? null)}
                >
                  + row in {row.section.trim()}
                </Button>
              </li>
            )}
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

/**
 * A section's heading, editable in place. Held locally while typing and applied
 * on blur/Enter — renaming on every keystroke would regroup the rows mid-word
 * (and clearing the box to retype would drop the heading outright). Clearing it
 * and leaving removes the heading; its rows stay, just ungrouped.
 */
function SectionNameInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (name: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Input
      aria-label="Section name"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== value) onCommit(text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      placeholder="Section name (clear to remove)"
      className="h-9 font-semibold"
    />
  );
}

/**
 * The ingredient line's text field. Re-parses the amount/unit when you finish
 * editing (blur) — but only if you actually changed the text, so tabbing through
 * doesn't overwrite a quantity you tuned by hand.
 */
function RawTextInput({
  label,
  value,
  onChange,
  onReparse,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onReparse: (text: string) => void;
}) {
  // The text as it was when the field gained focus, to detect a real edit.
  const focusValue = useRef<string | null>(null);
  return (
    <Input
      aria-label={label}
      value={value}
      onFocus={() => {
        focusValue.current = value;
      }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (focusValue.current !== null && focusValue.current !== value) onReparse(value);
        focusValue.current = null;
      }}
      placeholder="e.g. 8 oz cream cheese"
      className="flex-1"
    />
  );
}

/**
 * A quantity field that accepts fractions and decimals ("1/2", "1 1/2", "½",
 * "0.25"), not just whole numbers. Edits are held as text and parsed to a number
 * on blur/Enter; an unreadable entry snaps back to the last good value. Stays in
 * sync when the amount is re-read from the line's text.
 */
function QuantityInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (quantity: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  function commit() {
    const t = text.trim();
    if (t === '') {
      onCommit(null);
      return;
    }
    const n = parseQuantity(t);
    if (n != null) onCommit(n);
    else setText(value == null ? '' : String(value));
  }

  return (
    <Input
      aria-label={label}
      // Text, not decimal, so a fraction slash is typeable on a phone keyboard.
      inputMode="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      placeholder="qty"
    />
  );
}
