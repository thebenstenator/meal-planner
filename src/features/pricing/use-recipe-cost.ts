import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchConversionInfos, pricingKeys } from '@/features/pricing/api';
import type { ConversionInfo, PriceInfo } from '@/features/pricing/price-item';
import { recipeCost, type CostableIngredient, type RecipeCost } from '@/features/pricing/recipe-cost';
import { useCurrentPrices, usePricingSettings } from '@/features/pricing/use-pricing';

export interface PriceIndex {
  priceByCanonical: Map<string, PriceInfo>;
  infoByCanonical: Map<string, ConversionInfo>;
  storeId: string | null;
  isLoading: boolean;
}

/**
 * Load current prices + conversion facts for a set of canonical ingredients at
 * the household's default store. Shared by recipe and planner costing so we make
 * one price/store fetch and reuse it across many recipes.
 */
export function usePriceIndex(canonicalIds: string[]): PriceIndex {
  const { data: settings } = usePricingSettings();
  const storeId = settings?.defaultStoreId ?? null;
  const { data: prices, isLoading: pricesLoading } = useCurrentPrices(storeId);

  const ids = useMemo(() => [...new Set(canonicalIds)].sort(), [canonicalIds]);

  const { data: infos, isLoading: infosLoading } = useQuery({
    queryKey: pricingKeys.conversions(ids),
    queryFn: () => fetchConversionInfos(ids),
    enabled: ids.length > 0,
  });

  return useMemo(() => {
    const priceByCanonical = new Map<string, PriceInfo>();
    for (const p of prices ?? []) {
      priceByCanonical.set(p.canonicalId, {
        priceCents: p.priceCents,
        packageQuantity: p.packageQuantity,
        packageUnit: p.packageUnit,
      });
    }
    const infoByCanonical = new Map<string, ConversionInfo>(
      (infos ?? []).map((i) => [i.canonicalId, i]),
    );
    return {
      priceByCanonical,
      infoByCanonical,
      storeId,
      isLoading: pricesLoading || infosLoading,
    };
  }, [prices, infos, storeId, pricesLoading, infosLoading]);
}

export interface RecipeCostResult extends RecipeCost {
  storeId: string | null;
  isLoading: boolean;
}

/** Consumption cost of one recipe at the default store. */
export function useRecipeCost(
  ingredients: CostableIngredient[],
  servings: number,
): RecipeCostResult {
  const canonicalIds = useMemo(
    () => ingredients.map((i) => i.canonicalId).filter((id): id is string => !!id),
    [ingredients],
  );
  const index = usePriceIndex(canonicalIds);

  return useMemo(() => {
    const cost = recipeCost(ingredients, servings, index.priceByCanonical, index.infoByCanonical);
    return { ...cost, storeId: index.storeId, isLoading: index.isLoading };
  }, [ingredients, servings, index]);
}
