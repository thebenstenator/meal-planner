import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

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
import { useRenameHousehold } from '@/features/household/use-household-mutations';
import {
  householdSettingsSchema,
  type HouseholdSettingsInput,
} from '@/schemas/household';

interface RenameCardProps {
  householdId: string;
  currentName: string;
  canEdit: boolean;
}

export function RenameCard({ householdId, currentName, canEdit }: RenameCardProps) {
  const rename = useRenameHousehold(householdId);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<HouseholdSettingsInput>({
    resolver: zodResolver(householdSettingsSchema),
    values: { name: currentName },
  });

  const onSubmit = handleSubmit((values) => {
    rename.mutate(values.name, { onSuccess: () => reset({ name: values.name }) });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household name</CardTitle>
        <CardDescription>
          {canEdit
            ? 'Shown across the app to everyone in the household.'
            : 'Only the household owner can change the name.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="household-name">Name</Label>
            <Input
              id="household-name"
              disabled={!canEdit || rename.isPending}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>
          {rename.isError && (
            <p className="text-destructive text-sm">Couldn’t save. Try again.</p>
          )}
          {canEdit && (
            <Button type="submit" disabled={!isDirty || rename.isPending}>
              {rename.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
