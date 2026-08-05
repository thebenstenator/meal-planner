import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/use-auth';
import {
  acceptHouseholdInvite,
  createHouseholdInvite,
  householdKeys,
  renameHousehold,
  setMonthlyBudget,
  type InviteResult,
} from '@/features/household/api';
import { useUiStore } from '@/app/store/ui-store';

export function useRenameHousehold(householdId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (name: string) => renameHousehold(householdId, name),
    onSuccess: () => {
      if (user) void qc.invalidateQueries({ queryKey: householdKeys.mine(user.id) });
    },
  });
}

export function useSetMonthlyBudget(householdId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (cents: number | null) => setMonthlyBudget(householdId, cents),
    onSuccess: () => {
      if (user) void qc.invalidateQueries({ queryKey: householdKeys.mine(user.id) });
    },
  });
}

export function useCreateInvite(householdId: string) {
  const qc = useQueryClient();
  return useMutation<InviteResult, Error>({
    mutationFn: () => createHouseholdInvite(householdId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: householdKeys.invites(householdId) });
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const setActiveHouseholdId = useUiStore((s) => s.setActiveHouseholdId);
  return useMutation<string, Error, string>({
    mutationFn: (code: string) => acceptHouseholdInvite(code),
    onSuccess: (householdId) => {
      setActiveHouseholdId(householdId);
      if (user) void qc.invalidateQueries({ queryKey: householdKeys.mine(user.id) });
    },
  });
}
