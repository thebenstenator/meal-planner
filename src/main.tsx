import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers';
import { initObservability } from '@/lib/observability';
import { pruneOldCaches } from '@/lib/query/persister';
import '@/styles/globals.css';

void initObservability();

// Before anything tries to write the current cache, reclaim the space the
// previous key versions are still holding.
pruneOldCaches();

// A lazily-imported chunk failed to load — almost always a stale page after a
// new deploy (the old hashed chunk is gone from the server, so the SPA rewrite
// returns index.html and the module fetch fails the MIME check). Reload once to
// pick up the fresh build. A short cooldown guards against a reload loop if the
// failure is something persistent.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'preload-reload-at';
  const last = Number(sessionStorage.getItem(KEY) ?? '0');
  if (Date.now() - last < 15_000) return; // reloaded very recently — let it surface
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
