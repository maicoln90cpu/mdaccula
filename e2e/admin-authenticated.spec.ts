import { test, expect } from '@playwright/test';

/**
 * Authenticated /admin smoke test.
 *
 * Logs in via the public /auth page using credentials from env:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *
 * The user must already exist in Supabase auth AND have a row in
 * `user_roles` with role='admin'. If env vars are missing, the test
 * is skipped (does not fail) so local runs without secrets stay green.
 */
test.describe('Authenticated /admin', () => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/PASSWORD not set');

  test('admin user reaches the admin panel', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Fill the sign-in form. Auth page exposes inputs by type.
    await page.locator('input[type="email"]').first().fill(email!);
    await page.locator('input[type="password"]').first().fill(password!);

    // Submit — pick the submit button inside the active form.
    await page.getByRole('button', { name: /entrar|sign in|login/i }).first().click();

    // Navigate to /admin after auth completes.
    await page.waitForURL(/\/$|\/admin/, { timeout: 15_000 }).catch(() => undefined);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    // Expect the admin heading to render (ProtectedRoute passed).
    await expect(page.getByRole('heading', { name: /Painel Administrativo/i })).toBeVisible({
      timeout: 15_000,
    });
    expect(page.url()).toMatch(/\/admin\b/);
  });
});
