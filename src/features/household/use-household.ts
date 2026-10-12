import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { fetchMyHouseholds, householdKeys, type HouseholdSummary } from '@/features/household/api';
import { useUiStore } from '@/app/store/ui-store';

export interface UseHouseholdResult {
  /** All households the user belongs to (usually one). */
  households: HouseholdSummary[];
  /** The household currently in view. */
  household: HouseholdSummary | null;
  /** Convenience: the active household id, or null while loading / signed out. */
  householdId: string | null;
  /** The user's role in the active household. */
  role: 'owner' | 'member' | null;
  isLoading: boolean;
  isError: boolean;
  setActiveHouseholdId: (id: string) => void;
}

/**
 * The household id that every other feature's queries hang off of. Resolves the
 * user's memberships and picks the active one (the store's selection, falling
 * back to the first). RLS enforces isolation server-side regardless.
 */
export function useHousehold(): UseHouseholdResult {
  const { user } = useAuth();
  const activeHouseholdId = useUiStore((s) => s.activeHouseholdId);
  const setActiveHouseholdId = useUiStore((s) => s.setActiveHouseholdId);

  const query = useQuery({
    queryKey: householdKeys.mine(user?.id ?? 'anon'),
    queryFn: fetchMyHouseholds,
    enabled: !!user,
  });

  const households = query.data ?? [];
  const household =
    households.find((h) => h.id === activeHouseholdId) ?? households[0] ?? null;

  return {
    households,
    household,
    householdId: household?.id ?? null,
    role: household?.role ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    setActiveHouseholdId,
  };
}

/**
 * For mutations: the active household id, fetched fresh if it isn't known yet.
 * Right after sign-up the households query can still be loading — or have run a
 * beat before the new household existed and cached an empty list — and a write
 * fired then must not go out as `household_id=null`. Refetching also fills the
 * shared cache, so the rest of the app picks the household up too.
 */
export function useEnsureHouseholdId(): () => Promise<string> {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { householdId } = useHousehold();
  const activeHouseholdId = useUiStore((s) => s.activeHouseholdId);

  return useCallback(async () => {
    if (householdId) return householdId;
    const households = await qc.fetchQuery({
      queryKey: householdKeys.mine(user?.id ?? 'anon'),
      queryFn: fetchMyHouseholds,
      staleTime: 0,
    });
    const id = (households.find((h) => h.id === activeHouseholdId) ?? households[0])?.id;
    if (!id) throw new Error('Your household is still being set up — try again in a moment.');
    return id;
  }, [householdId, qc, user?.id, activeHouseholdId]);
}
