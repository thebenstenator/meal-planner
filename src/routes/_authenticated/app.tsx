import { createFileRoute, Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { useHousehold } from '@/features/household/use-household';
import { expiryLabel, type ExpiringItem } from '@/features/insights/insights';
import { useInsights } from '@/features/insights/use-insights';
import type { LibraryRecipe } from '@/features/planner/autofill';

export const Route = createFileRoute('/_authenticated/app')({
  component: AppHome,
});

function AppHome() {
  const { household, isLoading } = useHousehold();
  const { isPremium } = useEntitlement();
  const insights = useInsights();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your kitchen</h1>
        {isLoading ? (
          <p className="text-muted-foreground mt-1 text-sm">Loading your household…</p>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm" data-testid="active-household">
            {household?.name ?? 'Your household'}
          </p>
        )}
      </div>

      {isPremium && !insights.isLoading && (
        <div className="space-y-4" data-testid="insights">
          <UseItUpCard items={insights.expiring} />
          <HaventMadeCard recipes={insights.stale} />
          <MixItUpCard repeats={insights.variety.repeats} />

          {insights.empty && (
            <p className="text-muted-foreground text-sm">
              Nothing needs your attention right now. Plan a week or scan a receipt to get more out
              of your kitchen.
            </p>
          )}
        </div>
      )}

      {!isPremium && (
        <div className="bg-muted/40 space-y-1 rounded-lg border p-4">
          <p className="text-sm font-medium">Smart suggestions</p>
          <p className="text-muted-foreground text-sm">
            Premium surfaces what to cook next, what to use up before it spoils, and when your week
            needs more variety.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild variant="outline">
          <Link to="/planner">Open planner</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/household/settings">Manage household</Link>
        </Button>
      </div>
    </main>
  );
}

function Card({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: 'amber' | 'emerald';
  children: React.ReactNode;
}) {
  const bar =
    accent === 'amber' ? 'border-l-amber-500' : accent === 'emerald' ? 'border-l-emerald-500' : '';
  return (
    <section className={`rounded-lg border border-l-4 p-4 ${bar}`}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function UseItUpCard({ items }: { items: ExpiringItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card title="Use it up" accent="amber">
      <ul className="mb-3 space-y-1">
        {items.slice(0, 6).map((i) => (
          <li key={i.id} className="flex items-center justify-between text-sm">
            <span className="capitalize">{i.canonicalName}</span>
            <span className={i.daysLeft < 0 ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
              {expiryLabel(i.daysLeft)}
            </span>
          </li>
        ))}
      </ul>
      <Button asChild size="sm" variant="outline">
        <Link to="/suggest">Find recipes to use these</Link>
      </Button>
    </Card>
  );
}

function HaventMadeCard({ recipes }: { recipes: LibraryRecipe[] }) {
  if (recipes.length === 0) return null;
  return (
    <Card title="Haven’t made in a while" accent="emerald">
      <ul className="mb-3 flex flex-wrap gap-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              to="/recipes/$recipeId"
              params={{ recipeId: r.id }}
              className="hover:bg-accent inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
            >
              {r.isFavorite && <span className="text-amber-500">★</span>}
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild size="sm" variant="outline">
        <Link to="/planner">Plan one in</Link>
      </Button>
    </Card>
  );
}

function MixItUpCard({ repeats }: { repeats: { title: string; count: number }[] }) {
  if (repeats.length === 0) return null;
  const top = repeats[0]!;
  return (
    <Card title="Mix it up">
      <p className="text-muted-foreground mb-3 text-sm">
        {top.title} shows up {top.count} times this week
        {repeats.length > 1 ? `, and ${repeats.length - 1} other${repeats.length > 2 ? 's' : ''} repeat too` : ''}.
        A little variety keeps meals interesting.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link to="/planner">Review the week</Link>
      </Button>
    </Card>
  );
}
