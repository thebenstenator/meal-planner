import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import type { RecipeIngredientDraft } from '@/features/recipes/api';
import { parseIngredientBlock } from '@/features/recipes/parse-block';

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
              <Input
                aria-label={`Ingredient ${i + 1} text`}
                value={row.rawText}
                onChange={(e) => update(i, { rawText: e.target.value })}
                placeholder="e.g. 8 oz cream cheese"
                className="flex-1"
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
              <Input
                aria-label={`Ingredient ${i + 1} quantity`}
                inputMode="decimal"
                value={row.quantity ?? ''}
                onChange={(e) =>
                  update(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="qty"
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
