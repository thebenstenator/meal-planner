import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
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
import { useAcceptInvite } from '@/features/household/use-household-mutations';
import { inviteCodeSchema, type InviteCodeInput } from '@/schemas/auth';

export function JoinCard() {
  const accept = useAcceptInvite();
  const [joined, setJoined] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteCodeInput>({
    resolver: zodResolver(inviteCodeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setJoined(false);
    accept.mutate(values.code, {
      onSuccess: () => {
        setJoined(true);
        reset({ code: '' });
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join a household</CardTitle>
        <CardDescription>Enter an invite code someone shared with you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-code-input">Invite code</Label>
            <Input
              id="invite-code-input"
              autoCapitalize="characters"
              className="font-mono uppercase tracking-widest"
              placeholder="ABCD2345"
              aria-invalid={!!errors.code}
              {...register('code')}
            />
            {errors.code && (
              <p className="text-destructive text-sm">{errors.code.message}</p>
            )}
          </div>
          {accept.isError && (
            <p role="alert" className="text-destructive text-sm">
              {accept.error.message}
            </p>
          )}
          {joined && (
            <p role="status" className="text-sm text-green-600">
              Joined! You now have access to that household.
            </p>
          )}
          <Button type="submit" variant="outline" disabled={accept.isPending}>
            {accept.isPending ? 'Joining…' : 'Join household'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
