import { useEffect } from 'react';

import { useUiStore } from '@/app/store/ui-store';
import { applyTheme } from '@/app/theme';

/**
 * Keeps the applied theme in sync with the store, and — while on "system" —
 * follows the OS preference live. Renders nothing; the initial class is set by
 * the inline boot script in index.html so there's no flash before this mounts.
 */
export function ThemeWatcher() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  return null;
}
