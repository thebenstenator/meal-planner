import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import {
  fetchConversionInfos,
  fetchHouseholdEstimates,
  fetchReferencePrices,
  pricingKeys,
  type EffectivePrice,
} from '@/features/pricing/api';
import { computeCalibration, type Calibration } from '@/features/pricing/calibration';
import { useCurrentPrices, usePricingSettings } from '@/features/pricing/use-pricing';

export interface EffectivePrices {
  /** Canonical id → its price: the household's store price, else the calibrated reference. */
  byCanonical: Map<string, EffectivePrice>;
  storeId: string | null;
  calibration: Calibration;
  isLoading: boolean;
}

/**
 * The one price source for costing (ADR 0021). A household's own store price
 * always wins; anything it hasn't priced falls back to the shared reference —
 * scaled by how its real prices compare to the reference, once it has enough of
 * them — and is tagged `source: 'reference'` so the UI can mark it EST. Works
 * with no store at all, so costs show from a household's first day.
 */
export function useEffectivePrices(): EffectivePrices {
  const { householdId } = useHousehold();
  const { data: settings } = usePricingSettings();
  const storeId = settings?.defaultStoreId ?? null;
  const { data: storePrices, isLoading: storeLoading } = useCurrentPrices(storeId);

  const { data: reference, isLoading: refLoading } = useQuery({
    queryKey: pricingKeys.referencePrices(),
    queryFn: fetchReferencePrices,
    // Shipped reference data: changes only with a migration.
    staleTime: 24 * 60 * 60 * 1000,
  });

  // The household's AI estimates (ADR 0022): reference-like prices for
  // ingredients the shared reference doesn't cover.
  const { data: aiEstimates, isLoading: aiLoading } = useQuery({
    queryKey: pricingKeys.householdEstimates(householdId ?? 'none'),
    queryFn: () => fetchHouseholdEstimates(householdId as string),
    enabled: !!householdId,
  });

  // Items priced both ways — what calibration learns from.
  const overlapIds = useMemo(() => {
    const refIds = new Set((reference ?? []).map((r) => r.canonicalId));
    return (storePrices ?? [])
      .map((p) => p.canonicalId)
      .filter((id) => refIds.has(id))
      .sort();
  }, [storePrices, reference]);

  const { data: overlapInfos, isLoading: infosLoading } = useQuery({
    queryKey: pricingKeys.conversions(overlapIds),
    queryFn: () => fetchConversionInfos(overlapIds),
    enabled: overlapIds.length > 0,
  });

  return useMemo(() => {
    const refById = new Map((reference ?? []).map((r) => [r.canonicalId, r]));
    const infoById = new Map((overlapInfos ?? []).map((i) => [i.canonicalId, i]));

    const calibration = computeCalibration(
      (storePrices ?? [])
        .filter((p) => refById.has(p.canonicalId))
        .map((p) => ({
          store: p,
          reference: refById.get(p.canonicalId)!,
          info: infoById.get(p.canonicalId) ?? {},
        })),
    );

    const byCanonical = new Map<string, EffectivePrice>();
    for (const r of reference ?? []) {
      byCanonical.set(r.canonicalId, {
        ...r,
        priceCents: Math.round(r.priceCents * calibration.factor),
        source: 'reference',
      });
    }
    for (const r of aiEstimates ?? []) {
      byCanonical.set(r.canonicalId, {
        ...r,
        priceCents: Math.round(r.priceCents * calibration.factor),
        source: 'reference',
      });
    }
    for (const p of storePrices ?? []) byCanonical.set(p.canonicalId, { ...p, source: 'store' });

    return {
      byCanonical,
      storeId,
      calibration,
      isLoading: storeLoading || refLoading || aiLoading || (overlapIds.length > 0 && infosLoading),
    };
  }, [
    reference,
    aiEstimates,
    storePrices,
    overlapInfos,
    storeId,
    storeLoading,
    refLoading,
    aiLoading,
    infosLoading,
    overlapIds,
  ]);
}
