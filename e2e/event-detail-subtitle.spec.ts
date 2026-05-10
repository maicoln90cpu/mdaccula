import { test, expect } from '@playwright/test';

/**
 * Verifies that an event with a subtitle in the database renders the
 * subtitle just below the H1 title on the EventDetail page.
 *
 * Uses a known seeded slug ('up2026' → "🏝️ Universo Paralello 2026").
 * If that event is removed in the future, update the slug below.
 */
test.describe('EventDetail subtitle', () => {
  const slug = 'up2026';

  test('renders subtitle below the title', async ({ page }) => {
    const response = await page.goto(`/eventos/${slug}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'event page should respond OK').toBeLessThan(400);

    // Title appears
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible({ timeout: 10_000 });
    await expect(h1).toContainText(/Universo Paralello/i);

    // Subtitle appears just after the title
    const subtitle = page.getByTestId('event-subtitle');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toContainText(/.+/);

    // Structural check: subtitle is the next sibling of <h1>
    const isSiblingAfterH1 = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      const node = document.querySelector('[data-testid="event-subtitle"]');
      return !!heading && !!node && heading.nextElementSibling === node;
    });
    expect(isSiblingAfterH1, 'subtitle should be the immediate sibling after H1').toBe(true);
  });
});
