import { createFileRoute } from '@tanstack/react-router';

import { BudgetCard } from '@/features/household/components/budget-card';
import { InviteCard } from '@/features/household/components/invite-card';
import { JoinCard } from '@/features/household/components/join-card';
import { MembersCard } from '@/features/household/components/members-card';
import { ProfileCard } from '@/features/household/components/profile-card';
import { RenameCard } from '@/features/household/components/rename-card';
import { useHousehold } from '@/features/household/use-household';
import { RemindersCard } from '@/features/reminders/components/reminders-card';

export const Route = createFileRoute('/_authenticated/household/settings')({
  component: HouseholdSettingsPage,
});

function HouseholdSettingsPage() {
  const { household, householdId, role, isLoading, isError } = useHousehold();

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Household</h1>
        <p className="text-muted-foreground text-sm">
          Manage your household, members, and invites.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && (
        <p className="text-destructive text-sm">Couldn’t load your household.</p>
      )}

      {household && householdId && (
        <div className="space-y-6">
          <ProfileCard />
          <RenameCard
            householdId={householdId}
            currentName={household.name}
            canEdit={role === 'owner'}
          />
          <BudgetCard
            householdId={householdId}
            monthlyBudgetCents={household.monthlyBudgetCents}
            canEdit={role === 'owner'}
          />
          <RemindersCard />
          <MembersCard householdId={householdId} />
          <InviteCard householdId={householdId} />
          <JoinCard />
        </div>
      )}
    </main>
  );
}
