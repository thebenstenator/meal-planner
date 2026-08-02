import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CanonicalIngredient, CanonicalInput } from '@/features/ingredients/api';
import {
  useCreateCanonical,
  useMergeCanonical,
  useUpdateCanonical,
} from '@/features/ingredients/use-ingredients';

interface FormValues {
  name: string;
  aliases: string;
  category: string;
  defaultUnit: string;
  densityGPerMl: string;
  unitSizeQuantity: string;
  unitSizeUnit: string;
  countToGram: string;
}

function toNumber(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toInput(v: FormValues): CanonicalInput {
  return {
    name: v.name.trim(),
    aliases: v.aliases
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0),
    category: v.category.trim() || null,
    defaultUnit: v.defaultUnit.trim() || null,
    densityGPerMl: toNumber(v.densityGPerMl),
    unitSizeQuantity: toNumber(v.unitSizeQuantity),
    unitSizeUnit: v.unitSizeUnit.trim() || null,
    countToGram: toNumber(v.countToGram),
  };
}

interface Props {
  /** Editing an existing household row, or undefined to create a new one. */
  ingredient?: CanonicalIngredient;
  /** Rows the current row may be merged into (create mode has none). */
  mergeTargets: CanonicalIngredient[];
  onDone: () => void;
}

export function CanonicalEditor({ ingredient, mergeTargets, onDone }: Props) {
  const create = useCreateCanonical();
  const update = useUpdateCanonical();
  const merge = useMergeCanonical();

  const { register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      name: ingredient?.name ?? '',
      aliases: ingredient?.aliases.join(', ') ?? '',
      category: ingredient?.category ?? '',
      defaultUnit: ingredient?.defaultUnit ?? '',
      densityGPerMl: ingredient?.densityGPerMl?.toString() ?? '',
      unitSizeQuantity: ingredient?.unitSizeQuantity?.toString() ?? '',
      unitSizeUnit: ingredient?.unitSizeUnit ?? '',
      countToGram: ingredient?.countToGram?.toString() ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const input = toInput(values);
    if (input.name.length === 0) return;
    if (ingredient) {
      await update.mutateAsync({ id: ingredient.id, input });
    } else {
      await create.mutateAsync(input);
    }
    onDone();
  });

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">
        {ingredient ? `Edit ${ingredient.name}` : 'Add a household ingredient'}
      </h3>

      <Field label="Name" htmlFor="ci-name">
        <Input id="ci-name" {...register('name')} />
      </Field>
      <Field label="Aliases (comma-separated)" htmlFor="ci-aliases">
        <Input id="ci-aliases" placeholder="philadelphia, philly" {...register('aliases')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="ci-cat">
          <Input id="ci-cat" placeholder="dairy" {...register('category')} />
        </Field>
        <Field label="Default unit" htmlFor="ci-unit">
          <Input id="ci-unit" placeholder="oz" {...register('defaultUnit')} />
        </Field>
        <Field label="Density (g/ml)" htmlFor="ci-density">
          <Input id="ci-density" inputMode="decimal" {...register('densityGPerMl')} />
        </Field>
        <Field label="Count → grams" htmlFor="ci-ctg">
          <Input id="ci-ctg" inputMode="decimal" {...register('countToGram')} />
        </Field>
        <Field label="Package size" htmlFor="ci-usq">
          <Input id="ci-usq" inputMode="decimal" placeholder="8" {...register('unitSizeQuantity')} />
        </Field>
        <Field label="Package unit" htmlFor="ci-usu">
          <Input id="ci-usu" placeholder="oz" {...register('unitSizeUnit')} />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (!formState.isDirty && !ingredient)}>
          {pending ? 'Saving…' : ingredient ? 'Save changes' : 'Add ingredient'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>

      {ingredient && mergeTargets.length > 0 && (
        <div className="border-t pt-3">
          <Label htmlFor="merge-target" className="text-muted-foreground">
            Merge this into another ingredient
          </Label>
          <div className="mt-1 flex gap-2">
            <select
              id="merge-target"
              className="border-input h-11 flex-1 rounded-md border bg-transparent px-2 text-sm"
              defaultValue=""
              onChange={async (e) => {
                const targetId = e.target.value;
                if (targetId) {
                  await merge.mutateAsync({ sourceId: ingredient.id, targetId });
                  onDone();
                }
              }}
            >
              <option value="">Choose target…</option>
              {mergeTargets
                .filter((t) => t.id !== ingredient.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isGlobal ? ' (global)' : ''}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
