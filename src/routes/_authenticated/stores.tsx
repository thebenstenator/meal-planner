import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchCanonicalNames } from '@/features/pricing/api';
import {
  useCurrentPrices,
  usePricingSettings,
  useStoreMutations,
  useStores,
} from '@/features/pricing/use-pricing';
import { formatCurrency } from '@/lib/utils/format-currency';

export const Route = createFileRoute('/_authenticated/stores')({
  component: StoresPage,
});

function StoresPage() {
  const { data: stores } = useStores();
  const { data: settings } = usePricingSettings();
  const m = useStoreMutations();
  const [newName, setNewName] = useState('');

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Stores & prices</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your stores</CardTitle>
          <CardDescription>Prices are tracked per store. Set a default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim() === '') return;
              m.create.mutate(newName.trim());
              setNewName('');
            }}
          >
            <Input
              aria-label="New store name"
              placeholder="Walmart — Eagle Mountain"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={m.create.isPending}>
              Add
            </Button>
          </form>

          <ul className="divide-y">
            {(stores ?? []).map((s) => {
              const isDefault = settings?.defaultStoreId === s.id;
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    {s.name}
                    {isDefault && <Badge variant="secondary">default</Badge>}
                  </span>
                  <div className="flex items-center gap-1">
                    {!isDefault && (
                      <Button variant="ghost" size="sm" onClick={() => m.setDefault.mutate(s.id)}>
                        Set default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => m.remove.mutate(s.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
            {stores && stores.length === 0 && (
              <li className="text-muted-foreground py-2 text-sm">
                No stores yet. Add the one you shop at.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staleness threshold</CardTitle>
          <CardDescription>Flag prices older than this many days for review.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="stale-days">Days</Label>
              <Input
                id="stale-days"
                inputMode="numeric"
                className="w-24"
                defaultValue={settings?.priceStaleDays ?? 30}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) m.setStaleDays.mutate(v);
                }}
              />
            </div>
            <span className="text-muted-foreground pb-2 text-xs">Saved on blur.</span>
          </div>
        </CardContent>
      </Card>

      <PricesReview
        storeId={settings?.defaultStoreId ?? null}
        staleDays={settings?.priceStaleDays ?? 30}
      />
    </main>
  );
}

function PricesReview({ storeId, staleDays }: { storeId: string | null; staleDays: number }) {
  const { data: prices } = useCurrentPrices(storeId);
  const ids = (prices ?? []).map((p) => p.canonicalId);
  const { data: names } = useQuery({
    queryKey: ['canonical-names', ids],
    queryFn: () => fetchCanonicalNames(ids),
    enabled: ids.length > 0,
  });

  if (!storeId) return null;

  const rows = (prices ?? []).map((p) => ({
    ...p,
    name: names?.[p.canonicalId] ?? p.canonicalId,
    stale: differenceInCalendarDays(new Date(), new Date(p.observedOn)) > staleDays,
  }));
  rows.sort((a, b) => Number(b.stale) - Number(a.stale));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prices at your default store</CardTitle>
        <CardDescription>
          Stale prices are flagged — update them from a shopping list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No prices recorded yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.canonicalId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {r.name}
                  {r.stale && (
                    <Badge variant="outline" className="text-amber-600">
                      stale
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatCurrency(r.priceCents)} / {r.packageQuantity} {r.packageUnit} ·{' '}
                  {r.observedOn}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
