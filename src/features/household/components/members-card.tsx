import { useQuery } from '@tanstack/react-query';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { fetchHouseholdMembers, householdKeys } from '@/features/household/api';

export function MembersCard({ householdId }: { householdId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: householdKeys.members(householdId),
    queryFn: () => fetchHouseholdMembers(householdId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>People who can view and edit this household.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground text-sm">Loading members…</p>}
        {isError && (
          <p className="text-destructive text-sm">Couldn’t load members. Try again.</p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y">
            {data.map((m) => (
              <li key={m.userId} className="flex items-center justify-between py-3">
                <span className="text-sm">{m.email ?? m.userId}</span>
                <span className="text-muted-foreground text-xs capitalize">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
