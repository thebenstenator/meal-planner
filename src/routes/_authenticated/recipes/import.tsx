import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useHousehold } from '@/features/household/use-household';
import type { RecipeDetail } from '@/features/recipes/api';
import { RecipeForm } from '@/features/recipes/components/recipe-form';
import {
  fileToImage,
  ImportError,
  parseRecipeImages,
  toImportDetail,
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
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next = await Promise.all([...files].map(fileToImage));
    setImages((prev) => [...prev, ...next].slice(0, 6));
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
      const limitReached = err instanceof ImportError && err.limitReached;
      setError({
        message: err instanceof Error ? err.message : 'Could not read that recipe',
        limitReached,
      });
      setStep('error');
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
        <h1 className="text-2xl font-semibold">Import from photo</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Snap the recipe — multiple pages are fine. We’ll read it and let you review.
        </p>
      </div>

      {step !== 'error' && (
        <>
          <label className="border-input hover:bg-accent block cursor-pointer rounded-lg border border-dashed p-6 text-center text-sm">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            Add photos ({images.length}/6)
          </label>

          {images.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <li key={i} className="relative">
                  <img src={img.preview} alt={`Page ${i + 1}`} className="h-28 w-full rounded object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove page ${i + 1}`}
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
              ? 'You’ve used this month’s photo imports. You can still add recipes by hand.'
              : 'The photo may be blurry or hard to read. You can retry, or enter it manually.'}
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
