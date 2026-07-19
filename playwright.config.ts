import { defineConfig, devices } from '@playwright/test';

// Loads .env.local (gitignored) into process.env for local runs, e.g.
// E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD — see e2e/helpers/adminAuth.ts.
// CI sets these via secrets instead, so a missing file here is expected.
try {
  process.loadEnvFile('.env.local');
} catch {
  // no .env.local — fine, admin-gated specs just skip themselves.
}

/**
 * Playwright E2E configuration.
 * Boots the Vite dev server on :8080 and runs smoke specs against it.
 */
// Dedicated port for the Vite dev server Playwright spawns — deliberately not
// 8080 (Vite's default), so E2E never silently reuses/collides with some
// unrelated project's dev server already listening on the common port.
const E2E_PORT = 8091;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testDir: './e2e',
      testIgnore: ['full-site/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'viewport-mobile',
      testDir: './e2e/full-site',
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'viewport-tablet',
      testDir: './e2e/full-site',
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'viewport-desktop',
      testDir: './e2e/full-site',
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: `http://localhost:${E2E_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { VITE_DEV_SERVER_PORT: String(E2E_PORT) },
      },
});
