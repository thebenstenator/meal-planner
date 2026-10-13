import { differenceInCalendarDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchConversionInfos, pricingKeys, type EffectivePrice } from '@/features/pricing/api';
import { estimateItemCost } from '@/features/pricing/price-item';
import { useEffectivePrices } from '@/features/pricing/use-effective-prices';
import { usePricingSettings } from '@/features/pricing/use-pricing';
import type { ShoppingItem } from '@/features/shopping-list/api';

export interface ItemPricing {
  estimatedCents: number | null;
  stale: boolean;
  /** Whether the household has its own store price for it (else it's priced from reference). */
  hasPrice: boolean;
  /** Priced from the shared reference — shown as EST (ADR 0021). */
  isReference: boolean;
}

export interface ListPricing {
  storeId: string | null;
  byItemId: Map<string, ItemPricing>;
  projectedTotalCents: number;
  unpricedCount: number;
  staleCount: number;
  /** Items in the projected total priced from the reference (no store or paid price). */
  referenceCount: number;
  /** Canonical ids on the list with no price at all — what an AI estimate can fill. */
  missingPriceIds: string[];
  isLoading: boolean;
}

/**
 * Price every priceable item in a list: the household's default-store price, else
 * the calibrated reference price (marked isReference, shown EST).
 */
export function useListPricing(items: ShoppingItem[]): ListPricing {
  const { data: settings } = usePricingSettings();
  const prices = useEffectivePrices();
  const storeId = prices.storeId;
  const staleDays = settings?.priceStaleDays ?? 30;

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
    const priceByCanonical: Map<string, EffectivePrice> = prices.byCanonical;
    const infoByCanonical = new Map((infos ?? []).map((i) => [i.canonicalId, i]));

    const byItemId = new Map<string, ItemPricing>();
    let projectedTotalCents = 0;
    let unpricedCount = 0;
    let staleCount = 0;
    let referenceCount = 0;

    for (const item of items) {
      // Ad-hoc / unmatched / unresolved items aren't auto-priceable.
      if (!item.canonicalId || item.unresolved) {
        byItemId.set(item.id, { estimatedCents: null, stale: false, hasPrice: false, isReference: false });
        continue;
      }
      const price = priceByCanonical.get(item.canonicalId);
      if (!price) {
        byItemId.set(item.id, { estimatedCents: null, stale: false, hasPrice: false, isReference: false });
        continue;
      }
      const info = infoByCanonical.get(item.canonicalId) ?? {};
      const estimatedCents = estimateItemCost(item.totalQuantity, item.unit, price, info);
      const isReference = price.source === 'reference';
      // Staleness is about the household's own prices; the reference has an as-of date instead.
      const stale =
        !isReference && differenceInCalendarDays(new Date(), new Date(price.observedOn)) > staleDays;
      if (stale) staleCount += 1;
      byItemId.set(item.id, { estimatedCents, stale, hasPrice: !isReference, isReference });
    }

    // The projected total is what the trip costs: a recorded paid price where
    // there is one (as Spent does), else the estimate. An item with neither is
    // unpriced.
    for (const item of items) {
      const cents = item.actualCostCents ?? byItemId.get(item.id)?.estimatedCents ?? null;
      if (cents == null) unpricedCount += 1;
      else projectedTotalCents += cents;
      if (item.actualCostCents == null && byItemId.get(item.id)?.isReference) referenceCount += 1;
    }

    return {
      storeId,
      byItemId,
      projectedTotalCents,
      unpricedCount,
      staleCount,
      referenceCount,
      missingPriceIds: [
        ...new Set(
          items
            .filter((i) => i.canonicalId && !i.unresolved && !priceByCanonical.has(i.canonicalId))
            .map((i) => i.canonicalId as string),
        ),
      ],
      isLoading: prices.isLoading || infosLoading,
    };
  }, [items, prices, infos, staleDays, storeId, infosLoading]);
}
