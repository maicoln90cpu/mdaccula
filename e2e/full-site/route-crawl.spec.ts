import { test, expect } from '@playwright/test';
import { loginAsAdmin, skipIfNoAdminCreds } from '../helpers/adminAuth';
import { ALL_ROUTES } from './registries/routes';
import { assertNoHorizontalOverflow } from './helpers/overflow';

/**
 * Crawls every registered route (public + admin) at the current project's viewport
 * and asserts it renders without horizontal overflow or an ErrorBoundary fallback.
 *
 * Registry-driven: add a new page? Add one line to registries/routes.ts.
 * This is NOT an exhaustive guarantee — only routes listed there are covered.
 */
test.describe('Full-site route crawl', () => {
  for (const route of ALL_ROUTES) {
    test(`${route.id} renders without overflow or crash`, async ({ page }) => {
      if (route.requiresAdmin) {
        skipIfNoAdminCreds(test);
        await loginAsAdmin(page);
      }

      const target = route.discover ? await route.discover(page) : route.path!;
      const response = await page.goto(target, { waitUntil: 'domcontentloaded' });
      expect(response?.status() ?? 0).toBeLessThan(400);

      await expect(page.locator('body')).not.toBeEmpty();
      await expect(page.getByText('Algo deu errado')).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
    });
  }
});
