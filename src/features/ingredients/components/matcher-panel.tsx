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
import { useMatchCanonical } from '@/features/ingredients/use-ingredients';

/**
 * Type a messy ingredient name, see what the matcher resolves it to and how
 * (exact / alias / learned / trigram). This is the Slice 3 demo:
 * "philly cream cheese" -> "cream cheese".
 */
export function MatcherPanel() {
  const [raw, setRaw] = useState('philly cream cheese');
  const match = useMatchCanonical();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test the matcher</CardTitle>
        <CardDescription>
          See how a raw ingredient name maps to a canonical ingredient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            match.mutate(raw);
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="matcher-input">Raw name</Label>
            <Input
              id="matcher-input"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="e.g. philly cream cheese"
            />
          </div>
          <Button type="submit" disabled={match.isPending || raw.trim().length === 0}>
            {match.isPending ? 'Matching…' : 'Match'}
          </Button>
        </form>

        {match.isError && (
          <p className="text-destructive text-sm">Match failed. Try again.</p>
        )}

        {match.isSuccess && (
          <div data-testid="match-result" className="rounded-md border p-3 text-sm">
            {match.data ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Matched to</span>
                <strong>{match.data.name}</strong>
                <Badge variant="secondary">{match.data.method}</Badge>
                <span className="text-muted-foreground">
                  score {match.data.score.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                No confident match — this would become a new household ingredient.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
