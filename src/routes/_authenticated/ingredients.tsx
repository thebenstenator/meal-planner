import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CanonicalIngredient } from '@/features/ingredients/api';
import { CanonicalEditor } from '@/features/ingredients/components/canonical-editor';
import { MatcherPanel } from '@/features/ingredients/components/matcher-panel';
import { useCanonicalList } from '@/features/ingredients/use-ingredients';

export const Route = createFileRoute('/_authenticated/ingredients')({
  component: IngredientsPage,
});

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; ingredient: CanonicalIngredient };

function IngredientsPage() {
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const { data, isLoading, isError } = useCanonicalList(search);

  const items = data ?? [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Ingredients</h1>
        <p className="text-muted-foreground text-sm">
          The canonical list that powers consolidation. Global items are shared;
          you can add and edit your household’s own.
        </p>
      </div>

      <MatcherPanel />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search ingredients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search ingredients"
        />
        <Button
          variant="outline"
          onClick={() => setEditor({ mode: 'create' })}
          className="shrink-0"
        >
          Add
        </Button>
      </div>

      {editor.mode !== 'closed' && (
        <CanonicalEditor
          ingredient={editor.mode === 'edit' ? editor.ingredient : undefined}
          mergeTargets={items}
          onDone={() => setEditor({ mode: 'closed' })}
        />
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load ingredients.</p>}
      {data && items.length === 0 && (
        <p className="text-muted-foreground text-sm">No ingredients match “{search}”.</p>
      )}

      <ul className="divide-y">
        {items.map((ci) => (
          <li key={ci.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{ci.name}</span>
                {ci.isGlobal ? (
                  <Badge variant="outline">global</Badge>
                ) : (
                  <Badge variant="secondary">yours</Badge>
                )}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {ci.category ?? 'uncategorized'}
                {ci.aliases.length > 0 && ` · ${ci.aliases.slice(0, 4).join(', ')}`}
              </div>
            </div>
            {!ci.isGlobal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditor({ mode: 'edit', ingredient: ci })}
              >
                Edit
              </Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
