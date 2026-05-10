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
    await page.waitForSelector('a[href]', { timeout: 10_000 });
    expect(await page.locator('a[href]').count()).toBeGreaterThan(0);
  });

  test('/eventos lists event cards', async ({ page }) => {
    const response = await page.goto('/eventos', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    // EventDetail links use /eventos/:slug pattern
    await page.waitForSelector('a[href^="/eventos/"]', { timeout: 15_000 });
    expect(await page.locator('a[href^="/eventos/"]').count()).toBeGreaterThan(0);
  });

  test('/blog renders post links', async ({ page }) => {
    const response = await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await page.waitForSelector('a[href^="/blog/"]', { timeout: 15_000 });
    expect(await page.locator('a[href^="/blog/"]').count()).toBeGreaterThan(0);
  });

  test('/admin redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/auth/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/auth/);
  });
});
