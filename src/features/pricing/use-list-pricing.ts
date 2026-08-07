import { differenceInCalendarDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchConversionInfos, pricingKeys, type CurrentPrice } from '@/features/pricing/api';
import { estimateItemCost } from '@/features/pricing/price-item';
import { useCurrentPrices, usePricingSettings } from '@/features/pricing/use-pricing';
import type { ShoppingItem } from '@/features/shopping-list/api';

export interface ItemPricing {
  estimatedCents: number | null;
  stale: boolean;
  hasPrice: boolean;
}

export interface ListPricing {
  storeId: string | null;
  byItemId: Map<string, ItemPricing>;
  projectedTotalCents: number;
  unpricedCount: number;
  staleCount: number;
  isLoading: boolean;
}

/** Price every priceable item in a list against the household's default store. */
export function useListPricing(items: ShoppingItem[]): ListPricing {
  const { data: settings } = usePricingSettings();
  const storeId = settings?.defaultStoreId ?? null;
  const staleDays = settings?.priceStaleDays ?? 30;
  const { data: prices, isLoading: pricesLoading } = useCurrentPrices(storeId);

  const canonicalIds = useMemo(
    () => [...new Set(items.map((i) => i.canonicalId).filter((id): id is string => !!id))],
    [items],
  );

  const { data: infos, isLoading: infosLoading } = useQuery({
    queryKey: pricingKeys.conversions(canonicalIds),
    queryFn: () => fetchConversionInfos(canonicalIds),
    enabled: canonicalIds.length > 0,
  });

  return useMemo(() => {
    const priceByCanonical = new Map<string, CurrentPrice>();
    for (const p of prices ?? []) priceByCanonical.set(p.canonicalId, p);
    const infoByCanonical = new Map((infos ?? []).map((i) => [i.canonicalId, i]));

    const byItemId = new Map<string, ItemPricing>();
    let projectedTotalCents = 0;
    let unpricedCount = 0;
    let staleCount = 0;

    for (const item of items) {
      // Ad-hoc / unmatched / unresolved items aren't auto-priceable.
      if (!item.canonicalId || item.unresolved) {
        byItemId.set(item.id, { estimatedCents: null, stale: false, hasPrice: false });
        unpricedCount += 1;
        continue;
      }
      const price = priceByCanonical.get(item.canonicalId);
      if (!price) {
        byItemId.set(item.id, { estimatedCents: null, stale: false, hasPrice: false });
        unpricedCount += 1;
        continue;
      }
      const info = infoByCanonical.get(item.canonicalId) ?? {};
      const estimatedCents = estimateItemCost(item.totalQuantity, item.unit, price, info);
      const stale = differenceInCalendarDays(new Date(), new Date(price.observedOn)) > staleDays;
      if (estimatedCents == null) unpricedCount += 1;
      else projectedTotalCents += estimatedCents;
      if (stale) staleCount += 1;
      byItemId.set(item.id, { estimatedCents, stale, hasPrice: true });
    }

    return {
      storeId,
      byItemId,
      projectedTotalCents,
      unpricedCount,
      staleCount,
      isLoading: pricesLoading || infosLoading,
    };
  }, [items, prices, infos, staleDays, storeId, pricesLoading, infosLoading]);
}
