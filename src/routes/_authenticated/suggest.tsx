import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { useHousehold } from '@/features/household/use-household';
import { useClassifyIngredients } from '@/features/ingredients/use-ingredients';
import { toISO } from '@/features/planner/dates';
import { usePantry } from '@/features/pantry/use-pantry';
import { expiringSoonSeed, pantrySuggestSeed } from '@/features/pantry/suggest-seed';
import type { RecipeDetail } from '@/features/recipes/api';
import { RecipeForm } from '@/features/recipes/components/recipe-form';
import { ImportError } from '@/features/recipes/import';
import {
  addMissingToList,
  ideaToDetail,
  suggestMeals,
  type MealIdea,
} from '@/features/recipes/suggest';

export const Route = createFileRoute('/_authenticated/suggest')({
  component: SuggestPage,
});

const FILTERS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];
type Step = 'input' | 'loading' | 'ideas' | 'review' | 'error';

function SuggestPage() {
  const { householdId } = useHousehold();
  const navigate = useNavigate();
  const { data: pantry } = usePantry();
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<MealIdea[]>([]);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);

  const ingredients = text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Smart pantry seeds: the useful, prioritized list (not a raw 87-item dump) and
  // a shortcut for just what's about to spoil.
  const today = toISO(new Date());
  const smartSeed = useMemo(() => (pantry ? pantrySuggestSeed(pantry, today) : []), [pantry, today]);
  const expiringSeed = useMemo(
    () => (pantry ? expiringSoonSeed(pantry, today) : []),
    [pantry, today],
  );

  // Uncategorized pantry items (the free guesser couldn't place) — one AI pass
  // can sort them so the seed stops treating them as neutral. Deduped by id.
  const { isPremium } = useEntitlement();
  const classify = useClassifyIngredients();
  const uncategorized = useMemo(() => {
    const seen = new Set<string>();
    const out: { canonicalId: string; name: string }[] = [];
    for (const p of pantry ?? []) {
      if (p.category || seen.has(p.canonicalId)) continue;
      seen.add(p.canonicalId);
      out.push({ canonicalId: p.canonicalId, name: p.canonicalName });
    }
    return out;
  }, [pantry]);

  async function getIdeas() {
    if (!householdId || ingredients.length === 0) return;
    setStep('loading');
    setError(null);
    try {
      setIdeas(await suggestMeals(householdId, ingredients, filters));
      setStep('ideas');
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Could not come up with ideas',
        limitReached: err instanceof ImportError && err.limitReached,
      });
      setStep('error');
    }
  }

  async function save(idea: MealIdea) {
    if (!householdId) return;
    setDetail(await ideaToDetail(householdId, idea));
    setStep('review');
  }

  if (step === 'review' && detail) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button
          type="button"
          className="text-muted-foreground mb-3 text-sm underline"
          onClick={() => setStep('ideas')}
        >
          ← Back to ideas
        </button>
        <h1 className="text-2xl font-semibold">Save this idea</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Review the ingredients — nothing is stored until you save.
        </p>
        <RecipeForm initial={detail} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">What can I make?</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          List what you’ve got and get dinner ideas you can cook tonight.
        </p>
      </div>

      {step !== 'error' && (
        <>
          <Textarea
            aria-label="Ingredients you have"
            placeholder={'chicken thighs, rice, broccoli\nsoy sauce, garlic, eggs'}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {smartSeed.length > 0 && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setText(smartSeed.join(', '))}
                >
                  Use what’s in my pantry
                </button>
                {expiringSeed.length > 0 && (
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setText(expiringSeed.join(', '))}
                  >
                    Use things expiring soon ({expiringSeed.length})
                  </button>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Focuses on fresh and soon-to-expire ingredients — snacks, drinks, and staples are
                skipped.
              </p>
            </div>
          )}

          {/* Premium: sort items the free guesser left uncategorized (kept a
              sibling of the seed block so its feedback survives the pantry
              refetch that follows). */}
          {isPremium && (uncategorized.length > 0 || classify.isSuccess || classify.isError) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {uncategorized.length > 0 && (
                <button
                  type="button"
                  className="text-primary underline disabled:opacity-50"
                  disabled={classify.isPending}
                  onClick={() => classify.mutate(uncategorized)}
                >
                  {classify.isPending
                    ? 'Sorting…'
                    : `✨ Auto-sort ${uncategorized.length} uncategorized item${uncategorized.length === 1 ? '' : 's'}`}
                </button>
              )}
              {classify.isError && (
                <span className="text-destructive">
                  {classify.error instanceof ImportError && classify.error.limitReached
                    ? 'Monthly AI limit reached.'
                    : 'Couldn’t sort those — try again.'}
                </span>
              )}
              {classify.isSuccess && !classify.isPending && (
                <span className="text-emerald-700">Sorted {classify.data} items.</span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filters.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => (active ? prev.filter((x) => x !== f) : [...prev, f]))
                  }
                  className={`rounded-full border px-3 py-1 text-sm capitalize ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <Button onClick={getIdeas} disabled={step === 'loading' || ingredients.length === 0}>
            {step === 'loading' ? 'Thinking up ideas…' : 'Get ideas'}
          </Button>
        </>
      )}

      {step === 'ideas' && (
        <ul className="space-y-3">
          {ideas.map((idea, i) => (
            <IdeaCard
              key={i}
              idea={idea}
              onSave={() => save(idea)}
              onAddMissing={async () => {
                if (!householdId) return;
                const listId = await addMissingToList(householdId, idea.missing);
                await navigate({ to: '/shopping-list/$listId', params: { listId } });
              }}
            />
          ))}
        </ul>
      )}

      {step === 'error' && error && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">
            {error.limitReached ? 'Monthly AI limit reached' : 'Couldn’t come up with ideas'}
          </p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
          <div className="flex gap-2">
            {!error.limitReached && (
              <Button variant="outline" onClick={() => setStep('input')}>
                Try again
              </Button>
            )}
            <Button asChild>
              <Link to="/recipes/new">Add a recipe manually</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function IdeaCard({
  idea,
  onSave,
  onAddMissing,
}: {
  idea: MealIdea;
  onSave: () => void;
  onAddMissing: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <li className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{idea.title}</h2>
        <span className="text-muted-foreground shrink-0 text-xs">{idea.time_estimate}</span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{idea.pitch}</p>

      {idea.missing.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">need:</span>
          {idea.missing.map((m) => (
            <Badge key={m} variant="outline" className="text-amber-600">
              {m}
            </Badge>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground mt-2 text-xs underline"
      >
        {open ? 'Hide' : 'Show'} ingredients & steps
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-sm">
          <ul className="list-disc pl-5">
            {idea.ingredient_lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          {idea.instructions && (
            <p className="text-muted-foreground whitespace-pre-line">{idea.instructions}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onSave}>
          Save as recipe
        </Button>
        {idea.missing.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={adding}
            onClick={async () => {
              setAdding(true);
              try {
                await onAddMissing();
              } finally {
                setAdding(false);
              }
            }}
          >
            {adding ? 'Adding…' : 'Add missing to list'}
          </Button>
        )}
      </div>
    </li>
  );
}
