import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCreateInvite } from '@/features/household/use-household-mutations';

export function InviteCard({ householdId }: { householdId: string }) {
  const createInvite = useCreateInvite(householdId);
  const [copied, setCopied] = useState(false);

  const code = createInvite.data?.code ?? null;

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); the code is
      // still shown on screen to copy manually.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
        <CardDescription>
          Generate a code your partner enters to join this household. Expires in 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={() => createInvite.mutate()}
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? 'Generating…' : 'Generate invite code'}
        </Button>

        {createInvite.isError && (
          <p className="text-destructive text-sm">
            Couldn’t generate a code. Try again.
          </p>
        )}

        {code && (
          <div className="flex items-center gap-2">
            <code
              data-testid="invite-code"
              className="bg-muted rounded-md px-3 py-2 font-mono text-lg tracking-widest"
            >
              {code}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
