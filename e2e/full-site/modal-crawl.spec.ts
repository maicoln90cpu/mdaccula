import { test, expect } from '@playwright/test';
import { loginAsAdmin, skipIfNoAdminCreds } from '../helpers/adminAuth';
import { MODALS, SKIPPED_MODALS } from './registries/modals';
import { assertNoHorizontalOverflow, elementFitsViewport } from './helpers/overflow';

/**
 * Bounds a registry entry's open() call to a fixed deadline. Without this, a locator
 * with zero matches (e.g. an `optional` modal whose trigger isn't rendered this run)
 * retries with no timeout of its own and hangs until Playwright's test-level timeout
 * kills the whole test — which bypasses the try/catch below and turns a should-skip
 * case into a hard failure instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Opens every registered modal/dialog/sheet/popover and asserts it fits within the
 * current project's viewport (no horizontal overflow), then closes it via a safe
 * action (Escape or a Cancel/Close-labeled button — never Save/Confirm/Delete).
 *
 * Registry-driven: add a new modal? Add one line to registries/modals.ts.
 * Entries marked `optional` skip (not fail) when their trigger/surface doesn't show
 * up in time — they depend on data or environment conditions outside this suite's
 * control (see each entry's skipReason).
 */
test.describe('Full-site modal crawl', () => {
  for (const modal of MODALS) {
    test(`${modal.id} opens and fits viewport`, async ({ page }) => {
      if (modal.requiresAdmin) {
        skipIfNoAdminCreds(test);
        await loginAsAdmin(page);
      }

      await modal.navigate(page);

      const surface = modal.surface(page);
      try {
        await withTimeout(modal.open(page), 8_000, `${modal.id} open()`);
        await expect(surface).toBeVisible({ timeout: 8_000 });
      } catch (err) {
        if (modal.optional) {
          test.skip(true, modal.skipReason ?? 'Optional modal not reachable in this run');
        }
        throw err;
      }

      if (modal.settleMs) {
        // Radix Sheet/Dialog entrance transitions animate position/transform; measuring
        // the bounding box mid-animation gives a false "off-screen" reading. Wait for
        // the known transition duration to settle before asserting geometry.
        await page.waitForTimeout(modal.settleMs);
      }

      await elementFitsViewport(page, surface);
      await assertNoHorizontalOverflow(page);

      if (modal.close.kind === 'escape') {
        await page.keyboard.press('Escape');
      } else {
        await page.getByRole('button', { name: modal.close.name }).click();
      }
      await expect(surface).toBeHidden({ timeout: 5_000 });
    });
  }

  for (const skipped of SKIPPED_MODALS) {
    test(`${skipped.id} — SKIPPED`, async () => {
      test.skip(true, skipped.reason);
    });
  }
});
