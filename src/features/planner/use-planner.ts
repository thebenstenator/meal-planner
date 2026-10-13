import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useHousehold } from '@/features/household/use-household';
import {
  createPlanEntry,
  deletePlanEntry,
  fetchDiningInRange,
  listPlanEntries,
  movePlanEntry,
  planKeys,
  setEntryCost,
} from '@/features/planner/api';
import { supabase } from '@/lib/supabase/client';
import type { PlanEntryInput, Slot } from '@/schemas/plan';

export function usePlanEntries(start: string, end: string) {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: planKeys.range(householdId ?? 'none', start, end),
    queryFn: () => listPlanEntries(householdId as string, start, end),
    enabled: !!householdId,
  });
}


/**
 * Eating-out costs dated within [start, end] (ADR 0019). Keyed under the plan,
 * so adding, moving, pricing or removing an entry — here or on a partner's
 * phone via realtime — refreshes spend and forecast with it.
 */
export function useDiningInRange(start: string, end: string) {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: [...planKeys.all(householdId ?? 'none'), 'dining', start, end],
    queryFn: () => fetchDiningInRange(householdId as string, start, end),
    enabled: !!householdId,
  });
}
function useInvalidatePlan() {
  const qc = useQueryClient();
  const { householdId } = useHousehold();
  return () => qc.invalidateQueries({ queryKey: planKeys.all(householdId ?? 'none') });
}

export function useCreatePlanEntry() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidatePlan();
  return useMutation<string, Error, PlanEntryInput>({
    mutationFn: (input) => createPlanEntry(householdId as string, input),
    onSuccess: invalidate,
  });
}

export function useMovePlanEntry() {
  const invalidate = useInvalidatePlan();
  return useMutation<void, Error, { id: string; date: string; slot: Slot }>({
    mutationFn: ({ id, date, slot }) => movePlanEntry(id, { date, slot }),
    onSuccess: invalidate,
  });
}

export function useDeletePlanEntry() {
  const invalidate = useInvalidatePlan();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deletePlanEntry(id),
    onSuccess: invalidate,
  });
}

/**
 * Subscribe to plan_entry changes for the household and invalidate the plan
 * queries when anything changes, so a partner's edits appear live. RLS filters
 * which changes each client receives (realtime auth is set in AuthProvider).
 */
export function usePlanRealtime() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`plan:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_entry',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: planKeys.all(householdId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}

/** Set or clear (null) what an eating-out meal costs. */
export function useSetEntryCost() {
  const invalidate = useInvalidatePlan();
  return useMutation<void, Error, { id: string; cents: number | null }>({
    mutationFn: ({ id, cents }) => setEntryCost(id, cents),
    onSuccess: () => invalidate(),
  });
}
