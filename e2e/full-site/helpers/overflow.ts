import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Fails if the page has horizontal overflow (content wider than the viewport),
 * comparing document.documentElement.scrollWidth vs clientWidth.
 */
export async function assertNoHorizontalOverflow(page: Page, opts: { tolerancePx?: number } = {}): Promise<void> {
  const tolerancePx = opts.tolerancePx ?? 2;
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  const diff = scrollWidth - clientWidth;
  expect(
    diff,
    `Horizontal overflow detected: scrollWidth=${scrollWidth} clientWidth=${clientWidth} (diff=${diff}px)`
  ).toBeLessThanOrEqual(tolerancePx);
}

/**
 * Fails if the given element (typically an open modal/dialog/popover surface) spills
 * horizontally outside the current viewport. Vertical overflow is not checked — a
 * dialog with an internally scrollable body is expected, not a bug.
 */
export async function elementFitsViewport(page: Page, locator: Locator, opts: { tolerancePx?: number } = {}): Promise<void> {
  const tolerancePx = opts.tolerancePx ?? 2;
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport size set on page');

  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box (not visible/rendered)');

  expect(box.x, `Element starts left of viewport: x=${box.x}`).toBeGreaterThanOrEqual(-tolerancePx);
  expect(
    box.x + box.width,
    `Element right edge (${box.x + box.width}) exceeds viewport width (${viewport.width})`
  ).toBeLessThanOrEqual(viewport.width + tolerancePx);
}

/**
 * Polls the locator's bounding box until it stops moving (CSS entrance transition
 * finished) instead of sleeping a fixed duration. Faster on quick machines, still
 * safe on slow ones — resolves as soon as geometry is stable for a few reads in a
 * row, or gives up at maxWaitMs (falling through to whatever geometry it last saw).
 */
export async function waitForStableBoundingBox(
  page: Page,
  locator: Locator,
  opts: { maxWaitMs?: number; pollMs?: number; stableReadsNeeded?: number } = {}
): Promise<void> {
  const maxWaitMs = opts.maxWaitMs ?? 2_000;
  const pollMs = opts.pollMs ?? 50;
  const stableReadsNeeded = opts.stableReadsNeeded ?? 3;

  const start = Date.now();
  let last: { x: number; y: number; width: number; height: number } | null = null;
  let stableReads = 0;

  while (Date.now() - start < maxWaitMs) {
    const box = await locator.boundingBox();
    const isSameAsLast =
      !!box &&
      !!last &&
      Math.abs(box.x - last.x) < 0.5 &&
      Math.abs(box.y - last.y) < 0.5 &&
      Math.abs(box.width - last.width) < 0.5 &&
      Math.abs(box.height - last.height) < 0.5;

    stableReads = isSameAsLast ? stableReads + 1 : 0;
    if (stableReads >= stableReadsNeeded) return;

    last = box;
    await page.waitForTimeout(pollMs);
  }
}
