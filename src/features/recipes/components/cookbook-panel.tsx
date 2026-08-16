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
  useAcceptCookbookInvite,
  useCookbookMembers,
  useCookbooks,
  useCreateCookbook,
  useCreateCookbookInvite,
  useDeleteCookbook,
  useLeaveCookbook,
  useMyShareCounts,
  useShareAllWithCookbook,
} from '@/features/recipes/use-cookbook';
import { inviteCodeSchema } from '@/schemas/auth';

/**
 * The "shared cookbook" controls, shown on the Manage cookbooks page. A
 * household can be in any number of cookbooks — extended family, friends, a
 * supper club — each shown as its own card. Which recipes go into which cookbook
 * is chosen per recipe on the recipe form; recipe-level permissions live in
 * permissions.ts.
 */
export function CookbookPanel() {
  const { household } = useHousehold();
  const { data: cookbooks, isLoading } = useCookbooks();
  const [adding, setAdding] = useState(false);

  if (isLoading) return null;

  const mine = cookbooks ?? [];
  const defaultName = household ? `${household.name} recipes` : 'Family recipes';
  // With no cookbooks yet, lead with the two cards — that's the whole pitch.
  // Once you're in one, they collapse behind a link so the list stays the focus.
  const showForms = mine.length === 0 || adding;

  return (
    <div className="space-y-3">
      {mine.map((c) => (
        <CookbookCard key={c.id} cookbookName={c.name} isOwner={c.role === 'owner'} cookbookId={c.id} />
      ))}

      {mine.length > 0 && (
        <button
          type="button"
          className="text-muted-foreground text-sm underline"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? 'Never mind' : 'Start or join another cookbook'}
        </button>
      )}

      {showForms && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CreateCookbookCard defaultName={defaultName} onDone={() => setAdding(false)} />
          <JoinCookbookCard onDone={() => setAdding(false)} />
        </div>
      )}
    </div>
  );
}

function CreateCookbookCard({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const { householdId } = useHousehold();
  const create = useCreateCookbook();
  const [name, setName] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Share your recipes</CardTitle>
        <CardDescription>
          Start a shared cookbook so extended family can see your recipes and add their own. Your
          shopping list, pantry and plan stay private.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="cookbook-name">Cookbook name</Label>
        <Input
          id="cookbook-name"
          value={name}
          placeholder={defaultName}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          className="w-full"
          disabled={create.isPending || !householdId}
          onClick={() =>
            create.mutate(name.trim() || defaultName, {
              onSuccess: () => {
                setName('');
                onDone();
              },
            })
          }
        >
          {create.isPending ? 'Creating…' : 'Create shared cookbook'}
        </Button>
        {create.isError && (
          <p className="text-destructive text-sm">{create.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JoinCookbookCard({ onDone }: { onDone: () => void }) {
  // Both actions pass the household to a SECURITY DEFINER RPC that rejects a
  // null one with "not a member of this household". Straight after signup the
  // household is still resolving, so stay disabled until it's there rather than
  // let an early tap fail with a message about a household they do have.
  const { householdId } = useHousehold();
  const accept = useAcceptCookbookInvite();
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
        <CardTitle className="text-base">Join a cookbook</CardTitle>
        <CardDescription>Enter a code someone shared to see their recipes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="cookbook-join-code">Invite code</Label>
        <Input
          id="cookbook-join-code"
          value={code}
          autoCapitalize="characters"
          className="font-mono uppercase tracking-widest"
          placeholder="ABCD2345"
          onChange={(e) => setCode(e.target.value)}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={accept.isPending || !householdId}
          onClick={submit}
        >
          {accept.isPending ? 'Joining…' : 'Join cookbook'}
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

/**
 * How much of your library this cookbook actually holds, and a one-click way to
 * put the rest in. Creating a cookbook shares everything you have; *joining* one
 * shares nothing until you say so, and nothing on screen used to admit that — a
 * joiner could sit in a cookbook for weeks assuming their recipes were visible.
 * So the state is always stated, and the fix is one button away but never
 * automatic.
 */
function ShareBack({ cookbookId, cookbookName }: { cookbookId: string; cookbookName: string }) {
  const { total, byCookbook, isLoading } = useMyShareCounts();
  const shareAll = useShareAllWithCookbook();
  const [confirming, setConfirming] = useState(false);

  if (isLoading) return null;

  const shared = byCookbook[cookbookId] ?? 0;
  const missing = total - shared;

  return (
    <div className="bg-muted/40 space-y-2 rounded-md px-3 py-2">
      <p className="text-sm">
        {total === 0
          ? 'You haven’t added any recipes yet — once you do, they can go in here.'
          : shared === 0
            ? `None of your ${total} recipes are here yet — this cookbook only shows what others added.`
            : missing === 0
              ? `All ${total} of your recipes are here.`
              : `${shared} of your ${total} recipes are here.`}
      </p>

      {missing > 0 &&
        (!confirming ? (
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            {shared === 0 ? `Share all ${missing} of mine` : `Share the other ${missing}`}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">
              Add {missing} recipe{missing === 1 ? '' : 's'} to “{cookbookName}” for everyone in it?
            </span>
            <Button
              size="sm"
              disabled={shareAll.isPending}
              onClick={() =>
                shareAll.mutate(cookbookId, { onSuccess: () => setConfirming(false) })
              }
            >
              {shareAll.isPending ? 'Sharing…' : 'Share them'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ))}

      <p className="text-muted-foreground text-xs">
        You can also pick cookbooks one recipe at a time, under “Add to” on any recipe.
      </p>
    </div>
  );
}

function CookbookCard({
  cookbookName,
  isOwner,
  cookbookId,
}: {
  cookbookName: string;
  isOwner: boolean;
  cookbookId: string;
}) {
  const { householdId } = useHousehold();
  const { data: members } = useCookbookMembers(cookbookId);
  const invite = useCreateCookbookInvite(cookbookId);
  const leave = useLeaveCookbook();
  const del = useDeleteCookbook();
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
    <Card data-testid="cookbook-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{cookbookName}</CardTitle>
          <Badge variant="secondary">{isOwner ? 'You own this' : 'Shared with you'}</Badge>
        </div>
        <CardDescription>
          Everyone below sees the recipes shared here. Each household keeps control of the recipes
          it added — only they can edit or delete them
          {isOwner ? ', though you can remove any of them from this cookbook.' : '.'}
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

        <ShareBack cookbookId={cookbookId} cookbookName={cookbookName} />

        <div className="space-y-2">
          <Button size="sm" onClick={() => invite.mutate()} disabled={invite.isPending}>
            {invite.isPending ? 'Generating…' : 'Invite someone'}
          </Button>
          {code && (
            <div className="flex items-center gap-2">
              <code
                data-testid="cookbook-invite-code"
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
                Delete cookbook
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  Delete “{cookbookName}”? Recipes stay in each household but stop being shared.
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => del.mutate(cookbookId)}
                >
                  {del.isPending ? 'Deleting…' : 'Delete cookbook'}
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
              onClick={() => leave.mutate(cookbookId)}
            >
              {leave.isPending ? 'Leaving…' : 'Leave cookbook'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
