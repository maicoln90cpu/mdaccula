import { test, expect } from '@playwright/test';
import { E2E_KNOWN_EVENT_SLUG } from './fixtures';

/**
 * Verifies that an event with a subtitle in the database renders the
 * subtitle just below the H1 title on the EventDetail page.
 */
test.describe('EventDetail subtitle', () => {
  test('renders subtitle below the title', async ({ page }) => {
    const response = await page.goto(`/eventos/${E2E_KNOWN_EVENT_SLUG}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'event page should respond OK').toBeLessThan(400);

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible({ timeout: 10_000 });
    await expect(h1).toContainText(/Universo Paralello/i);

    const subtitle = page.getByTestId('event-subtitle');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toContainText(/.+/);

    const isSiblingAfterH1 = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      const node = document.querySelector('[data-testid="event-subtitle"]');
      return !!heading && !!node && heading.nextElementSibling === node;
    });
    expect(isSiblingAfterH1, 'subtitle should be the immediate sibling after H1').toBe(true);
  });
});
