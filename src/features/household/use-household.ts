import { useQuery } from '@tanstack/react-query';

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
