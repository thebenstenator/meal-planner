import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import type { RecipeIngredientDraft } from '@/features/recipes/api';
import { parseIngredientBlock } from '@/features/recipes/parse-block';
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
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { ...EMPTY_ROW }])}>
          Add row
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {showPaste ? 'Paste a block above, or add rows one at a time.' : 'Add rows one at a time.'}
        </p>
      )}

      <ul className="space-y-3">
        {value.map((row, i) => (
          <li key={i} className="space-y-2 rounded-lg border p-3">
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
        ))}
      </ul>
    </div>
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
