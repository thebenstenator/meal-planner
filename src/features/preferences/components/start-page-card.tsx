import { useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  getLandingPref,
  LANDING_OPTIONS,
  setLandingPref,
  type LandingPath,
} from '@/features/preferences/landing';

/**
 * Pick which page the app opens on. This is a personal, per-device choice — not a
 * household setting — so each member can land wherever suits them (one on Plan,
 * another on List) without stepping on each other.
 */
export function StartPageCard() {
  const [value, setValue] = useState<LandingPath>(() => getLandingPref());

  function onChange(next: LandingPath) {
    setValue(next);
    setLandingPref(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start page</CardTitle>
        <CardDescription>
          The page the app opens on. This is just for you, on this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="start-page">Open on</Label>
          <select
            id="start-page"
            value={value}
            onChange={(e) => onChange(e.target.value as LandingPath)}
            className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            {LANDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
