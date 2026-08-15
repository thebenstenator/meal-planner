import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useHousehold } from '@/features/household/use-household';
import type { RecipeDetail, RecipeIngredientDraft } from '@/features/recipes/api';
import { IngredientEditor } from '@/features/recipes/components/ingredient-editor';
import { guessMealTypes } from '@/features/recipes/guess-meal-type';
import { usePool } from '@/features/recipes/use-pool';
import { useSaveRecipe } from '@/features/recipes/use-recipes';
import { cn } from '@/lib/utils/cn';
import { MEAL_TYPES, recipeFormSchema, type MealType } from '@/schemas/recipe';

interface ScalarFields {
  title: string;
  description: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  source: string;
  instructions: string;
  tags: string;
}

interface Props {
  recipeId?: string;
  initial?: RecipeDetail;
  /** Show the "paste ingredients" box. Off on the import/suggestion review,
   * where the ingredients are already parsed into rows. */
  showPaste?: boolean;
}

export function RecipeForm({ recipeId, initial, showPaste = true }: Props) {
  const { householdId } = useHousehold();
  const navigate = useNavigate();
  const save = useSaveRecipe();

  const { register, handleSubmit, formState } = useForm<ScalarFields>({
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      servings: String(initial?.servings ?? 4),
      prepMinutes: initial?.prepMinutes != null ? String(initial.prepMinutes) : '',
      cookMinutes: initial?.cookMinutes != null ? String(initial.cookMinutes) : '',
      source: initial?.source ?? '',
      instructions: initial?.instructions ?? '',
      tags: initial?.tags.join(', ') ?? '',
    },
  });

  const [mealTypes, setMealTypes] = useState<MealType[]>(
    (initial?.mealTypes as MealType[]) ?? [],
  );
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>(
    initial?.ingredients ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  // New recipes join the shared pool by default (the library *is* the pool);
  // members can opt a recipe out to keep it private. Editing never re-homes a
  // recipe, so this only applies when creating.
  const { data: pool } = usePool();
  const isNew = !recipeId;
  const [shareToPool, setShareToPool] = useState(true);

  function toggleMeal(m: MealType) {
    setMealTypes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const numberOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
    // No meal type picked → guess one from the title, so the recipe is eligible
    // for a slot (an uncategorized recipe never gets auto-filled). Same fallback
    // the importers use.
    const effectiveMealTypes = mealTypes.length > 0 ? mealTypes : guessMealTypes(values.title);
    const parsed = recipeFormSchema.safeParse({
      title: values.title,
      description: values.description || undefined,
      mealTypes: effectiveMealTypes,
      servings: values.servings,
      prepMinutes: numberOrNull(values.prepMinutes),
      cookMinutes: numberOrNull(values.cookMinutes),
      instructions: values.instructions || undefined,
      source: values.source || undefined,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    try {
      const poolId = isNew && pool && shareToPool ? pool.id : undefined;
      const id = await save.mutateAsync({ form: parsed.data, ingredients, recipeId, poolId });
      // replace: don't leave the edit/create form in history, so the back button
      // returns to where you were (the recipe or the list), not the form.
      await navigate({ to: '/recipes/$recipeId', params: { recipeId: id }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register('title')} placeholder="Grandma’s cheesecake" />
        {formState.errors.title && (
          <p className="text-destructive text-sm">Title is required</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Meal types</Label>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMeal(m)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm capitalize',
                mealTypes.includes(m)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {isNew && pool && (
        <div className="flex items-start gap-2 rounded-lg border p-3">
          <input
            id="share-to-pool"
            type="checkbox"
            checked={shareToPool}
            onChange={(e) => setShareToPool(e.target.checked)}
            className="mt-0.5"
          />
          <Label htmlFor="share-to-pool" className="text-sm font-normal">
            Share with “{pool.name}”
            <span className="text-muted-foreground block text-xs">
              On by default — everyone in the pool will see this recipe. Uncheck to keep it private
              to your household.
            </span>
          </Label>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="servings">Servings</Label>
          <Input id="servings" inputMode="numeric" {...register('servings')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prep">Prep (min)</Label>
          <Input id="prep" inputMode="numeric" {...register('prepMinutes')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cook">Cook (min)</Label>
          <Input id="cook" inputMode="numeric" {...register('cookMinutes')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>

      {householdId && (
        <div className="space-y-2">
          <Label>Ingredients</Label>
          <IngredientEditor
            householdId={householdId}
            value={ingredients}
            onChange={setIngredients}
            showPaste={showPaste}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea id="instructions" rows={6} {...register('instructions')} placeholder="Markdown supported" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Input id="source" {...register('source')} placeholder="Grandma’s binder p. 4" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" {...register('tags')} placeholder="vegetarian, kid-approved" />
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : recipeId ? 'Save changes' : 'Create recipe'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            recipeId
              ? navigate({ to: '/recipes/$recipeId', params: { recipeId }, replace: true })
              : navigate({ to: '/recipes', replace: true })
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
