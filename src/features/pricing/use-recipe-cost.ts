import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchConversionInfos, pricingKeys } from '@/features/pricing/api';
import type { ConversionInfo, PriceInfo } from '@/features/pricing/price-item';
import { recipeCost, type CostableIngredient, type RecipeCost } from '@/features/pricing/recipe-cost';
import { useEffectivePrices } from '@/features/pricing/use-effective-prices';

export interface PriceIndex {
  priceByCanonical: Map<string, PriceInfo>;
  infoByCanonical: Map<string, ConversionInfo>;
  storeId: string | null;
  isLoading: boolean;
}

/**
 * Load prices + conversion facts for a set of canonical ingredients: the default
 * store's price where there is one, else the calibrated reference (ADR 0021).
 * Shared by recipe and planner costing so we make one price fetch and reuse it
 * across many recipes.
 */
export function usePriceIndex(canonicalIds: string[]): PriceIndex {
  const prices = useEffectivePrices();

  const ids = useMemo(() => [...new Set(canonicalIds)].sort(), [canonicalIds]);

  const { data: infos, isLoading: infosLoading } = useQuery({
    queryKey: pricingKeys.conversions(ids),
    queryFn: () => fetchConversionInfos(ids),
    enabled: ids.length > 0,
  });

  return useMemo(() => {
    const priceByCanonical = new Map<string, PriceInfo>();
    for (const p of prices.byCanonical.values()) {
      priceByCanonical.set(p.canonicalId, {
        priceCents: p.priceCents,
        packageQuantity: p.packageQuantity,
        packageUnit: p.packageUnit,
        isReference: p.source === 'reference',
      });
    }
    const infoByCanonical = new Map<string, ConversionInfo>(
      (infos ?? []).map((i) => [i.canonicalId, i]),
    );
    return {
      priceByCanonical,
      infoByCanonical,
      storeId: prices.storeId,
      isLoading: prices.isLoading || infosLoading,
    };
  }, [prices, infos, infosLoading]);
}

export interface RecipeCostResult extends RecipeCost {
  storeId: string | null;
  isLoading: boolean;
  /** True when the figure is a manually set meal price, not derived from ingredients. */
  isManual: boolean;
  /** Ingredients with no price at all (not even a reference) — what an AI estimate can fill. */
  missingPriceIds: string[];
}

/**
 * Consumption cost of one recipe at the default store. When `manualCostCents` is
 * set it wins: the figure is that flat price (no store or ingredient prices
 * needed), split evenly across servings.
 */
export function useRecipeCost(
  ingredients: CostableIngredient[],
  servings: number,
  manualCostCents?: number | null,
): RecipeCostResult {
  const canonicalIds = useMemo(
    () => ingredients.map((i) => i.canonicalId).filter((id): id is string => !!id),
    [ingredients],
  );
  const index = usePriceIndex(canonicalIds);

  return useMemo(() => {
    const missingPriceIds = [
      ...new Set(
        ingredients
          .filter((i) => !i.isOptional && i.canonicalId && !index.priceByCanonical.has(i.canonicalId))
          .map((i) => i.canonicalId as string),
      ),
    ];
    if (manualCostCents != null) {
      return {
        totalCents: manualCostCents,
        perServingCents: Math.round(manualCostCents / Math.max(1, servings)),
        pricedCount: 0,
        unpricedCount: 0,
        referenceCount: 0,
        storeId: index.storeId,
        isLoading: index.isLoading,
        isManual: true,
        missingPriceIds: [],
      };
    }
    const cost = recipeCost(ingredients, servings, index.priceByCanonical, index.infoByCanonical);
    return {
      ...cost,
      storeId: index.storeId,
      isLoading: index.isLoading,
      isManual: false,
      missingPriceIds,
    };
  }, [ingredients, servings, manualCostCents, index]);
}
