import {
  expect,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestType,
} from '@playwright/test';

type PlaywrightTest = TestType<
  PlaywrightTestArgs & PlaywrightTestOptions,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>;

export interface AdminLoginOptions {
  /** Path to navigate to after login completes. Defaults to '/admin'. */
  landingPath?: string;
}

/**
 * Logs in via the public /auth page using E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD env vars
 * and waits for the admin panel heading to confirm ProtectedRoute passed.
 *
 * The user must already exist in Supabase auth AND have a row in `user_roles`
 * with role='admin'. Call skipIfNoAdminCreds(test) first so specs skip cleanly
 * when the env vars are absent instead of failing.
 */
export async function loginAsAdmin(page: Page, opts: AdminLoginOptions = {}): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set — call skipIfNoAdminCreds(test) first');
  }

  await page.goto('/auth', { waitUntil: 'domcontentloaded' });

  // Fill the sign-in form. Auth page exposes inputs by type.
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  // Submit — pick the submit button inside the active form.
  await page.getByRole('button', { name: /entrar|sign in|login/i }).first().click();

  // Navigate to the landing path after auth completes.
  await page.waitForURL(/\/$|\/admin/, { timeout: 15_000 }).catch(() => undefined);
  await page.goto(opts.landingPath ?? '/admin', { waitUntil: 'domcontentloaded' });

  // Expect the admin heading to render (ProtectedRoute passed).
  await expect(page.getByRole('heading', { name: /Painel Administrativo/i })).toBeVisible({
    timeout: 15_000,
  });
}

/** Skips the current test/describe when admin credentials are not set in the environment. */
export function skipIfNoAdminCreds(test: PlaywrightTest): void {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, 'E2E_ADMIN_EMAIL/PASSWORD not set');
}
