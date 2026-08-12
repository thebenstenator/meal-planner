import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { useReminders } from '@/features/reminders/use-reminders';

/**
 * Turn on reminder notifications for this device (premium). Web Push, so on
 * iPhone it needs the app added to the Home Screen. Degrades gracefully when
 * push isn't supported or VAPID isn't configured yet.
 */
export function RemindersCard() {
  const { isPremium } = useEntitlement();
  const r = useReminders();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <CardDescription>
          Get a nudge on this device when pantry items are about to expire, so nothing goes to
          waste.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!isPremium ? (
          <p className="text-muted-foreground text-sm">
            Reminders are a premium feature.
          </p>
        ) : !r.supported ? (
          <p className="text-muted-foreground text-sm">
            This browser can’t do notifications. On iPhone, add the app to your Home Screen first,
            then open it from there.
          </p>
        ) : !r.configured ? (
          <p className="text-muted-foreground text-sm">
            Reminders aren’t switched on for this app yet — check back soon.
          </p>
        ) : r.subscribed ? (
          <div className="space-y-2">
            <p className="text-sm text-emerald-700">Reminders are on for this device.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={r.busy} onClick={() => void r.disable()}>
                {r.busy ? 'Working…' : 'Turn off on this device'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void r.sendTest()}>
                Send a test
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Nudges arrive once a day, and only when something is actually about to expire.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Button disabled={r.busy} onClick={() => void r.enable()}>
              {r.busy ? 'Working…' : 'Turn on reminders'}
            </Button>
            <p className="text-muted-foreground text-xs">
              You’ll be asked to allow notifications. Turn them on per device.
            </p>
          </div>
        )}
        {r.error && <p className="text-destructive text-sm">{r.error}</p>}
      </CardContent>
    </Card>
  );
}
