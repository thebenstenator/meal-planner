import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { useHousehold } from '@/features/household/use-household';
import { deletePushSubscription, savePushSubscription } from '@/features/reminders/api';
import {
  currentSubscription,
  isPushConfigured,
  isPushSupported,
  notificationPermission,
  subscribe,
  unsubscribe,
  type PermissionState,
} from '@/features/reminders/push';

export interface RemindersState {
  supported: boolean;
  configured: boolean;
  permission: PermissionState;
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/** Device-local reminder subscription state + enable/disable actions. */
export function useReminders(): RemindersState {
  const { householdId } = useHousehold();
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermissionState>(() => notificationPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void currentSubscription().then((s) => {
      if (active) setSubscribed(!!s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    if (!householdId || !user) return;
    setBusy(true);
    setError(null);
    try {
      const keys = await subscribe();
      setPermission(notificationPermission());
      if (!keys) {
        setError(
          notificationPermission() === 'denied'
            ? 'Notifications are blocked — allow them in your browser settings.'
            : 'Couldn’t turn reminders on.',
        );
        return;
      }
      await savePushSubscription(householdId, user.id, keys);
      setSubscribed(true);
    } catch {
      setError('Couldn’t turn reminders on — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const endpoint = await unsubscribe();
      if (endpoint) await deletePushSubscription(endpoint);
      setSubscribed(false);
    } catch {
      setError('Couldn’t turn reminders off — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return {
    supported: isPushSupported(),
    configured: isPushConfigured(),
    permission,
    subscribed,
    busy,
    error,
    enable,
    disable,
  };
}
