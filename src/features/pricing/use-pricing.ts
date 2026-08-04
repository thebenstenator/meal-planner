import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  addPriceRecord,
  createStore,
  deleteStore,
  getCurrentPrices,
  getPricingSettings,
  listStores,
  pricingKeys,
  renameStore,
  setDefaultStore,
  setPriceStaleDays,
} from '@/features/pricing/api';

export function useStores() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: pricingKeys.stores(householdId ?? 'none'),
    queryFn: () => listStores(householdId as string),
    enabled: !!householdId,
  });
}

export function usePricingSettings() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: pricingKeys.settings(householdId ?? 'none'),
    queryFn: () => getPricingSettings(householdId as string),
    enabled: !!householdId,
  });
}

export function useCurrentPrices(storeId: string | null) {
  return useQuery({
    queryKey: pricingKeys.currentPrices(storeId ?? 'none'),
    queryFn: () => getCurrentPrices(storeId as string),
    enabled: !!storeId,
  });
}

export function useStoreMutations() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: pricingKeys.stores(householdId ?? 'none') });
    void qc.invalidateQueries({ queryKey: pricingKeys.settings(householdId ?? 'none') });
  };
  return {
    create: useMutation<string, Error, string>({
      mutationFn: (name) => createStore(householdId as string, name),
      onSuccess: invalidate,
    }),
    rename: useMutation<void, Error, { id: string; name: string }>({
      mutationFn: ({ id, name }) => renameStore(id, name),
      onSuccess: invalidate,
    }),
    remove: useMutation<void, Error, string>({
      mutationFn: (id) => deleteStore(id),
      onSuccess: invalidate,
    }),
    setDefault: useMutation<void, Error, string | null>({
      mutationFn: (storeId) => setDefaultStore(householdId as string, storeId),
      onSuccess: invalidate,
    }),
    setStaleDays: useMutation<void, Error, number>({
      mutationFn: (days) => setPriceStaleDays(householdId as string, days),
      onSuccess: invalidate,
    }),
  };
}

export function useAddPrice() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { canonicalId: string; storeId: string; priceCents: number; packageQuantity: number; packageUnit: string }
  >({
    mutationFn: (input) => addPriceRecord(householdId as string, input),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: pricingKeys.currentPrices(vars.storeId) });
    },
  });
}
