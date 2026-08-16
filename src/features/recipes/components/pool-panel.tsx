import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
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
import { useHousehold } from '@/features/household/use-household';
import {
  useAcceptPoolInvite,
  useCreatePool,
  useCreatePoolInvite,
  useDeletePool,
  useLeavePool,
  usePoolMembers,
  usePools,
} from '@/features/recipes/use-pool';
import { inviteCodeSchema } from '@/schemas/auth';

/**
 * The "shared recipe pool" controls on the recipes page. A household can be in
 * any number of pools — extended family, friends, a supper club — each shown as
 * its own card. Which recipes go into which pool is chosen per recipe on the
 * recipe form; recipe-level permissions live in permissions.ts.
 */
export function PoolPanel() {
  const { household } = useHousehold();
  const { data: pools, isLoading } = usePools();
  const [adding, setAdding] = useState(false);

  if (isLoading) return null;

  const mine = pools ?? [];
  const defaultName = household ? `${household.name} recipes` : 'Family recipes';
  // With no pools yet, lead with the two cards — that's the whole pitch. Once
  // you're in one, they collapse behind a link so the list stays the focus.
  const showForms = mine.length === 0 || adding;

  return (
    <div className="space-y-3">
      {mine.map((p) => (
        <PoolCard key={p.id} poolName={p.name} isOwner={p.role === 'owner'} poolId={p.id} />
      ))}

      {mine.length > 0 && (
        <button
          type="button"
          className="text-muted-foreground text-sm underline"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? 'Never mind' : 'Start or join another pool'}
        </button>
      )}

      {showForms && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CreatePoolCard defaultName={defaultName} onDone={() => setAdding(false)} />
          <JoinPoolCard onDone={() => setAdding(false)} />
        </div>
      )}
    </div>
  );
}

function CreatePoolCard({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const create = useCreatePool();
  const [name, setName] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Share your recipes</CardTitle>
        <CardDescription>
          Start a shared pool so extended family can see your recipes and add their own. Your
          shopping list, pantry and plan stay private.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="pool-name">Pool name</Label>
        <Input
          id="pool-name"
          value={name}
          placeholder={defaultName}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          className="w-full"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(name.trim() || defaultName, {
              onSuccess: () => {
                setName('');
                onDone();
              },
            })
          }
        >
          {create.isPending ? 'Creating…' : 'Create shared pool'}
        </Button>
        {create.isError && (
          <p className="text-destructive text-sm">{create.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JoinPoolCard({ onDone }: { onDone: () => void }) {
  const accept = useAcceptPoolInvite();
  const [code, setCode] = useState('');

  function submit() {
    const parsed = inviteCodeSchema.safeParse({ code });
    if (!parsed.success) {
      return; // the field guidance already tells them the format
    }
    accept.mutate(parsed.data.code, {
      onSuccess: () => {
        setCode('');
        onDone();
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join a pool</CardTitle>
        <CardDescription>Enter a code someone shared to see their recipes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="pool-join-code">Invite code</Label>
        <Input
          id="pool-join-code"
          value={code}
          autoCapitalize="characters"
          className="font-mono uppercase tracking-widest"
          placeholder="ABCD2345"
          onChange={(e) => setCode(e.target.value)}
        />
        <Button variant="outline" className="w-full" disabled={accept.isPending} onClick={submit}>
          {accept.isPending ? 'Joining…' : 'Join pool'}
        </Button>
        {accept.isError && (
          <p role="alert" className="text-destructive text-sm">
            {accept.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PoolCard({
  poolName,
  isOwner,
  poolId,
}: {
  poolName: string;
  isOwner: boolean;
  poolId: string;
}) {
  const { householdId } = useHousehold();
  const { data: members } = usePoolMembers(poolId);
  const invite = useCreatePoolInvite(poolId);
  const leave = useLeavePool();
  const del = useDeletePool();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const code = invite.data?.code ?? null;

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable; the code is shown on screen to copy by hand.
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{poolName}</CardTitle>
          <Badge variant="secondary">{isOwner ? 'You own this' : 'Shared with you'}</Badge>
        </div>
        <CardDescription>
          Everyone below sees the recipes shared here. Each household keeps control of the recipes
          it added — only they can edit or delete them
          {isOwner ? ', though you can remove any of them from this pool.' : '.'} Pick which of your
          recipes to share on the recipe itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm">
          {(members ?? []).map((m) => (
            <li key={m.householdId} className="flex items-center justify-between gap-2">
              <span className="truncate">{m.email ?? m.householdName}</span>
              <span className="text-muted-foreground text-xs capitalize">{m.role}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Button size="sm" onClick={() => invite.mutate()} disabled={invite.isPending}>
            {invite.isPending ? 'Generating…' : 'Invite someone'}
          </Button>
          {code && (
            <div className="flex items-center gap-2">
              <code
                data-testid="pool-invite-code"
                className="bg-muted rounded-md px-3 py-2 font-mono text-lg tracking-widest"
              >
                {code}
              </code>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          )}
          {code && (
            <p className="text-muted-foreground text-xs">Expires in 7 days.</p>
          )}
        </div>

        <div className="border-t pt-3">
          {isOwner ? (
            !confirming ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Delete pool
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  Delete “{poolName}”? Recipes stay in each household but stop being shared.
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => del.mutate(poolId)}
                >
                  {del.isPending ? 'Deleting…' : 'Delete pool'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            )
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={leave.isPending || !householdId}
              onClick={() => leave.mutate(poolId)}
            >
              {leave.isPending ? 'Leaving…' : 'Leave pool'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
