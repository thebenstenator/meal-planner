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
import { useAuth } from '@/features/auth/use-auth';

/** Set/change your display name (drives the avatar initials and the account menu). */
export function ProfileCard() {
  const { user, updateName } = useAuth();
  const current = ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '').trim();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const dirty = value.trim() !== current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError(false);
    try {
      await updateName(value);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your name</CardTitle>
        <CardDescription>Shown as your avatar initials and in the account menu.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="display-name">Name</Label>
            <Input
              id="display-name"
              autoComplete="name"
              placeholder="e.g. Ben A"
              value={value}
              disabled={saving}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {error && <p className="text-destructive text-sm">Couldn’t save. Try again.</p>}
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
