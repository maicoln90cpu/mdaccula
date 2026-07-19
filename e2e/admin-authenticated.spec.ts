import { test, expect } from '@playwright/test';
import { loginAsAdmin, skipIfNoAdminCreds } from './helpers/adminAuth';

/**
 * Authenticated /admin smoke test.
 *
 * Logs in via the public /auth page using credentials from env:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *
 * If env vars are missing, the test is skipped (does not fail) so local runs
 * without secrets stay green.
 */
test.describe('Authenticated /admin', () => {
  skipIfNoAdminCreds(test);

  test('admin user reaches the admin panel', async ({ page }) => {
    await loginAsAdmin(page);
    expect(page.url()).toMatch(/\/admin\b/);

    // A URL/título corretos não garantem que o layout carregou — o menu lateral
    // (AdminSidebar) é o que de fato conecta o admin às outras telas. Se ele vier
    // vazio, a navegação real está quebrada mesmo com a rota "certa" na tela.
    const menuLinks = page.locator('[data-sidebar="menu-button"]');
    await expect(menuLinks.first()).toBeVisible({ timeout: 10_000 });
    expect(await menuLinks.count()).toBeGreaterThan(5);
  });
});
