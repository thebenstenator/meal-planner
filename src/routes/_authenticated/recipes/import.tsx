import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHousehold } from '@/features/household/use-household';
import type { RecipeDetail } from '@/features/recipes/api';
import { RecipeForm } from '@/features/recipes/components/recipe-form';
import {
  fileToImage,
  ImportError,
  parseRecipeImages,
  parseRecipeUrl,
  toImportDetail,
  urlImportToDetail,
  type ImageInput,
} from '@/features/recipes/import';

export const Route = createFileRoute('/_authenticated/recipes/import')({
  component: ImportRecipePage,
});

type Step = 'capture' | 'parsing' | 'review' | 'error';
type Img = ImageInput & { preview: string };

function ImportRecipePage() {
  const { householdId } = useHousehold();
  const [step, setStep] = useState<Step>('capture');
  const [images, setImages] = useState<Img[]>([]);
  const [url, setUrl] = useState('');
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next = await Promise.all([...files].map(fileToImage));
    setImages((prev) => [...prev, ...next].slice(0, 6));
  }

  function fail(err: unknown) {
    const limitReached = err instanceof ImportError && err.limitReached;
    setError({
      message: err instanceof Error ? err.message : 'Could not read that recipe',
      limitReached,
    });
    setStep('error');
  }

  async function parse() {
    if (!householdId || images.length === 0) return;
    setStep('parsing');
    setError(null);
    try {
      const parsed = await parseRecipeImages(
        householdId,
        images.map(({ media_type, data }) => ({ media_type, data })),
      );
      setDetail(await toImportDetail(householdId, parsed));
      setStep('review');
    } catch (err) {
      fail(err);
    }
  }

  async function parseUrl() {
    if (!householdId || url.trim() === '') return;
    setStep('parsing');
    setError(null);
    try {
      const { recipe, source } = await parseRecipeUrl(householdId, url.trim());
      setDetail(await urlImportToDetail(householdId, recipe, source));
      setStep('review');
    } catch (err) {
      fail(err);
    }
  }

  if (step === 'review' && detail) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Review imported recipe</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Check the highlighted rows, then save. Nothing is stored until you do.
        </p>
        <RecipeForm initial={detail} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Import a recipe</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste a link, snap a photo, or upload a PDF — we’ll read it and let you review.
        </p>
      </div>

      {step !== 'error' && (
        <>
          <div className="space-y-2">
            <label htmlFor="recipe-url" className="text-sm font-medium">
              From a website
            </label>
            <div className="flex gap-2">
              <Input
                id="recipe-url"
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    parseUrl();
                  }
                }}
              />
              <Button
                onClick={parseUrl}
                disabled={step === 'parsing' || url.trim() === ''}
              >
                Import
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs uppercase">or</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <label className="border-input hover:bg-accent block cursor-pointer rounded-lg border border-dashed p-6 text-center text-sm">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            Add photos or a PDF ({images.length}/6)
          </label>

          {images.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <li key={i} className="relative">
                  {img.media_type === 'application/pdf' ? (
                    <div className="bg-muted text-muted-foreground flex h-28 w-full flex-col items-center justify-center rounded text-xs">
                      <span className="text-lg">📄</span>
                      PDF
                    </div>
                  ) : (
                    <img
                      src={img.preview}
                      alt={`Page ${i + 1}`}
                      className="h-28 w-full rounded object-cover"
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove item ${i + 1}`}
                    className="bg-background absolute right-1 top-1 rounded-full border px-1.5 text-xs"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button onClick={parse} disabled={step === 'parsing' || images.length === 0}>
            {step === 'parsing' ? 'Reading recipe…' : 'Parse recipe'}
          </Button>
        </>
      )}

      {step === 'error' && error && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">
            {error.limitReached ? 'Monthly import limit reached' : 'Couldn’t read that recipe'}
          </p>
          <p className="text-muted-foreground text-sm">
            {error.limitReached
              ? 'You’ve used this month’s AI imports. You can still add recipes by hand.'
              : `${error.message}. You can retry, or enter it manually.`}
          </p>
          <div className="flex gap-2">
            {!error.limitReached && (
              <Button variant="outline" onClick={() => setStep('capture')}>
                Try again
              </Button>
            )}
            <Button asChild>
              <Link to="/recipes/new">Enter manually</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
