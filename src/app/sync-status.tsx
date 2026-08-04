import { onlineManager, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Visible sync status (specs/07 Slice 8). Offline: shows a badge with any
 * queued writes. Online with mutations in flight: "Syncing". Otherwise silent.
 */
export function SyncStatus() {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  const pending = useIsMutating();

  useEffect(() => onlineManager.subscribe(() => setOnline(onlineManager.isOnline())), []);

  if (online && pending === 0) return null;

  const offline = !online;
  return (
    <span
      data-testid="sync-status"
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        offline ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800',
      )}
    >
      {offline
        ? pending > 0
          ? `Offline · ${pending} queued`
          : 'Offline'
        : 'Syncing…'}
    </span>
  );
}
