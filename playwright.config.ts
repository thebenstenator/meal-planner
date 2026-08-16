import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright drives the dev server and runs the e2e smoke suite. Mobile-first,
 * so the default project emulates a phone viewport (10-conventions.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Playwright's 30s/5s defaults are too tight against a cold Supabase in CI: a
  // save plus a route change routinely overruns 5s, which surfaced as flakes in
  // four unrelated specs, all passing on retry. These are caps, not waits — a
  // passing test is no slower for them.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
