import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('home page loads with H1', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('/links renders at least one link card', async ({ page }) => {
    const response = await page.goto('/links', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    // Links page renders anchor tags for each link card.
    await page.waitForSelector('a[href]', { timeout: 10_000 });
    const count = await page.locator('a[href]').count();
    expect(count).toBeGreaterThan(0);
  });

  test('/admin redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    // ProtectedRoute either shows loading then navigates to /auth, or renders
    // "Acesso Negado". For an anonymous user we expect redirect to /auth.
    await page.waitForURL(/\/auth/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/auth/);
  });
});
