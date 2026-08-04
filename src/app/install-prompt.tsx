import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Add to home screen" prompt. The browser fires `beforeinstallprompt` only when
 * the PWA is installable (manifest + service worker) and not already installed;
 * we stash it and surface a button.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setDeferred(null));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!deferred) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
    >
      Install
    </Button>
  );
}
