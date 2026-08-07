import { supabase } from '@/lib/supabase/client';

/** Structured query keys, scoped as per 10-conventions.md. */
export const householdKeys = {
  mine: (userId: string) => ['households', userId] as const,
  members: (householdId: string) => ['household-members', householdId] as const,
  invites: (householdId: string) => ['household-invites', householdId] as const,
};

export interface HouseholdSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  monthlyBudgetCents: number | null;
  isPremium: boolean;
}

export interface HouseholdMemberRow {
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  email: string | null;
}

/** Households the current user belongs to, with their role in each. */
export async function fetchMyHouseholds(): Promise<HouseholdSummary[]> {
  const { data, error } = await supabase
    .from('household_member')
    .select('role, household:household_id (id, name, monthly_budget_cents, is_premium)')
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const h = row.household;
    if (!h) return [];
    return [
      {
        id: h.id,
        name: h.name,
        role: row.role as 'owner' | 'member',
        monthlyBudgetCents: h.monthly_budget_cents,
        isPremium: h.is_premium,
      },
    ];
  });
}

/** Members of a household, via the guarded RPC (email comes from auth.users). */
export async function fetchHouseholdMembers(
  householdId: string,
): Promise<HouseholdMemberRow[]> {
  const { data, error } = await supabase.rpc('get_household_members', {
    p_household_id: householdId,
  });
  if (error) throw error;

  return (data ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role as 'owner' | 'member',
    joinedAt: m.joined_at,
    email: m.email,
  }));
}

export async function renameHousehold(householdId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('household')
    .update({ name })
    .eq('id', householdId);
  if (error) throw error;
}

/** Set (or clear, with null) the household's monthly grocery budget goal. */
export async function setMonthlyBudget(
  householdId: string,
  cents: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('household')
    .update({ monthly_budget_cents: cents })
    .eq('id', householdId);
  if (error) throw error;
}

export interface InviteResult {
  code: string;
  expiresAt: string;
}

export async function createHouseholdInvite(householdId: string): Promise<InviteResult> {
  const { data, error } = await supabase.rpc('create_household_invite', {
    p_household_id: householdId,
  });
  if (error) throw error;
  if (!data) throw new Error('No invite returned');
  return { code: data.code, expiresAt: data.expires_at };
}

/** Accept an invite by code; returns the joined household id. */
export async function acceptHouseholdInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_household_invite', {
    p_code: code,
  });
  if (error) throw error;
  return data as string;
}
