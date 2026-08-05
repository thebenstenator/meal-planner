import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetMonthlyBudget } from '@/features/household/use-household-mutations';

interface BudgetCardProps {
  householdId: string;
  monthlyBudgetCents: number | null;
  canEdit: boolean;
}

/** Set the household's monthly grocery budget goal (dollars in the UI, cents in the DB). */
export function BudgetCard({ householdId, monthlyBudgetCents, canEdit }: BudgetCardProps) {
  const save = useSetMonthlyBudget(householdId);
  const [value, setValue] = useState(
    monthlyBudgetCents == null ? '' : (monthlyBudgetCents / 100).toFixed(0),
  );

  const trimmed = value.trim();
  const dollars = trimmed === '' ? null : Number(trimmed);
  const invalid = dollars !== null && (!Number.isFinite(dollars) || dollars < 0);
  const currentDollars = monthlyBudgetCents == null ? '' : (monthlyBudgetCents / 100).toFixed(0);
  const dirty = trimmed !== currentDollars;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    save.mutate(dollars === null ? null : Math.round(dollars * 100));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly budget</CardTitle>
        <CardDescription>
          {canEdit
            ? 'Your grocery goal for the month. The planner shows projected spend against it.'
            : 'Only the household owner can change the budget.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="monthly-budget">Amount (USD / month)</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                id="monthly-budget"
                inputMode="numeric"
                placeholder="e.g. 600"
                value={value}
                disabled={!canEdit || save.isPending}
                aria-invalid={invalid}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            {invalid && <p className="text-destructive text-sm">Enter a positive amount.</p>}
            <p className="text-muted-foreground text-xs">Leave blank to clear the goal.</p>
          </div>
          {save.isError && <p className="text-destructive text-sm">Couldn’t save. Try again.</p>}
          {canEdit && (
            <Button type="submit" disabled={!dirty || invalid || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
