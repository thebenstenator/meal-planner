import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHousehold } from '@/features/household/use-household';
import {
  draftFromFile,
  draftsFromText,
  draftsFromUrls,
  saveDraft,
  type DraftRecipe,
  type UrlImportResult,
} from '@/features/recipes/bulk-import-recipes';
import { cn } from '@/lib/utils/cn';

export const Route = createFileRoute('/_authenticated/recipes/bulk-import')({
  component: BulkImportPage,
});

type Mode = 'text' | 'url';

function BulkImportPage() {
  const { householdId } = useHousehold();
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [urls, setUrls] = useState('');
  const [drafts, setDrafts] = useState<DraftRecipe[] | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [failures, setFailures] = useState<UrlImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  async function parseText(files?: FileList | null) {
    if (!householdId) return;
    setBusy(true);
    setSaved(null);
    setFailures([]);
    try {
      const fromPaste = text.trim() ? await draftsFromText(householdId, text) : [];
      const fromFiles: DraftRecipe[] = [];
      const fails: UrlImportResult[] = [];
      for (const file of files ? [...files] : []) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        let content = '';
        if (isPdf) {
          const { extractPdfText } = await import('@/features/recipes/pdf-text');
          content = await extractPdfText(file);
        } else {
          content = await file.text();
        }
        const draft = content.trim() ? await draftFromFile(householdId, file.name, content) : null;
        if (draft) fromFiles.push(draft);
        else fails.push({ url: file.name, draft: null, error: 'No readable text (a scan?)' });
      }
      setDrafts([...fromPaste, ...fromFiles]);
      setFailures(fails);
      setSkip(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function importUrls() {
    if (!householdId) return;
    const list = urls
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    if (list.length === 0) return;
    setBusy(true);
    setSaved(null);
    try {
      const results = await draftsFromUrls(householdId, list);
      setDrafts(results.filter((r) => r.draft).map((r) => r.draft as DraftRecipe));
      setFailures(results.filter((r) => !r.draft));
      setSkip(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (!householdId || !drafts) return;
    setBusy(true);
    try {
      const selected = drafts.filter((_, i) => !skip.has(i));
      for (const d of selected) await saveDraft(householdId, d);
      setSaved(selected.length);
      setDrafts(null);
      setText('');
      setUrls('');
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = drafts ? drafts.length - skip.size : 0;

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Bulk import recipes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste recipes or links and add them all at once — no AI credits used.
        </p>
      </div>

      {saved != null && (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="font-medium">Saved {saved} recipe{saved === 1 ? '' : 's'}.</p>
          <Button asChild>
            <Link to="/recipes">Go to recipes</Link>
          </Button>
        </div>
      )}

      {!drafts && (
        <>
          <div className="flex rounded-md border p-0.5 text-sm">
            {(['text', 'url'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded px-3 py-1',
                  mode === m ? 'bg-primary text-primary-foreground' : '',
                )}
              >
                {m === 'text' ? 'Paste text' : 'Recipe links'}
              </button>
            ))}
          </div>

          {mode === 'text' ? (
            <>
              <Textarea
                aria-label="Paste recipes"
                rows={10}
                placeholder={
                  'Paste one or more recipes. Separate multiple recipes with a line of ---\n\n' +
                  'Cheese Danish\nServes 8\n\nIngredients\n2 packages cream cheese\n1/2 cup sugar\n\nDirections\nBeat and bake.'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => parseText()} disabled={busy || text.trim() === ''}>
                  {busy ? 'Reading…' : 'Parse recipes'}
                </Button>
                <label className="text-primary cursor-pointer text-sm underline">
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => parseText(e.target.files)}
                  />
                  …or upload .txt / .md / .pdf files
                </label>
              </div>
            </>
          ) : (
            <>
              <Textarea
                aria-label="Recipe links"
                rows={8}
                placeholder={'One recipe URL per line:\nhttps://example.com/banana-bread\nhttps://…'}
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Uses each site’s structured recipe data (schema.org) — free, no AI. Links without it
                are skipped and listed.
              </p>
              <Button onClick={importUrls} disabled={busy || urls.trim() === ''}>
                {busy ? 'Importing…' : 'Import links'}
              </Button>
            </>
          )}
        </>
      )}

      {drafts && (
        <>
          <div className="text-muted-foreground text-sm">
            {drafts.length} recipe{drafts.length === 1 ? '' : 's'} found — untick any you don’t want.
          </div>
          <ul className="divide-y rounded-lg border">
            {drafts.map((d, i) => (
              <li key={i} className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!skip.has(i)}
                  aria-label={`Include ${d.title}`}
                  onChange={(e) =>
                    setSkip((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {d.ingredients.length} ingredient{d.ingredients.length === 1 ? '' : 's'}
                    {d.unmatched > 0 && ` · ${d.unmatched} need matching later`}
                    {d.servings ? ` · serves ${d.servings}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {failures.length > 0 && (
            <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
              <p className="mb-1 font-medium">Couldn’t import ({failures.length}):</p>
              <ul className="space-y-0.5">
                {failures.map((f) => (
                  <li key={f.url} className="truncate">
                    {f.url}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={saveAll} disabled={busy || selectedCount === 0}>
              {busy ? 'Saving…' : `Save ${selectedCount} recipe${selectedCount === 1 ? '' : 's'}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDrafts(null);
                setFailures([]);
              }}
            >
              Back
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Recipes with unmatched ingredients still save — open any recipe to fix the matches.
          </p>
        </>
      )}

      {!drafts && saved == null && (
        <Button asChild variant="ghost" size="sm">
          <Link to="/recipes">Cancel</Link>
        </Button>
      )}
    </main>
  );
}
