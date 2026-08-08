import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
  },
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Full offline config lands in Slice 8. Kept minimal here so the
      // manifest and service worker exist from the start.
      manifest: {
        name: 'Mealplan',
        short_name: 'Mealplan',
        description: 'Meal planning, shopping lists, and grocery budgeting for households.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        // Launch straight into the app; `/` redirects by auth, but starting at
        // /app skips that hop for the (usually signed-in) installed user.
        start_url: '/app',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        cleanupOutdatedCaches: true,
        // Serve the SPA shell for offline route navigations (deep links).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/auth\//, /supabase/],
        // Layer push + notification-click handlers onto the generated SW.
        importScripts: ['push-sw.js'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Keep Playwright's e2e specs out of the Vitest run.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    css: false,
  },
});
