import { test, expect } from '@playwright/test';
import { watchPageHealth } from './helpers/pageHealth';

test.describe('Smoke', () => {
  test('home page loads with H1', async ({ page }) => {
    const health = watchPageHealth(page);
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10_000 });
    health.assertNoErrors();
  });

  test('/links renders at least one link card', async ({ page }) => {
    const health = watchPageHealth(page);
    const response = await page.goto('/links', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await page.waitForSelector('a[href]', { timeout: 10_000 });
    expect(await page.locator('a[href]').count()).toBeGreaterThan(0);
    health.assertNoErrors();
  });

  test('/eventos lists event cards', async ({ page }) => {
    const health = watchPageHealth(page);
    const response = await page.goto('/eventos', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    // Event cards navigate via onClick + useNavigate (Eventos.tsx), not <a href> —
    // there's no anchor to wait for; assert the cards themselves and that clicking
    // one actually routes to /eventos/:slug.
    await page.waitForSelector('.event-card', { timeout: 15_000 });
    expect(await page.locator('.event-card').count()).toBeGreaterThan(0);
    await page.locator('.event-card').first().click();
    await page.waitForURL(/\/eventos\/.+/, { timeout: 10_000 });
    health.assertNoErrors();
  });

  test('/blog renders post links', async ({ page }) => {
    const health = watchPageHealth(page);
    const response = await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await page.waitForSelector('a[href^="/blog/"]', { timeout: 15_000 });
    expect(await page.locator('a[href^="/blog/"]').count()).toBeGreaterThan(0);
    health.assertNoErrors();
  });

  test('/admin redirects unauthenticated user to /auth', async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/auth/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/auth/);
    health.assertNoErrors();
  });
});
