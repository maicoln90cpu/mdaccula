import { expect, type Page } from '@playwright/test';

export interface PageHealthWatcher {
  /** Fails the test if any uncaught JS error, console.error, or same-origin 4xx/5xx response happened. */
  assertNoErrors(): void;
}

/**
 * Attaches listeners that catch regressions route-crawl's overflow/status checks miss:
 * uncaught exceptions, console.error calls, and same-origin API/asset requests that
 * failed. Third-party requests (CDN, analytics, maps) are intentionally excluded —
 * they're outside this app's control and would make the suite flaky.
 *
 * Call before navigating, then call assertNoErrors() after the page has settled.
 */
export function watchPageHealth(page: Page): PageHealthWatcher {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  let origin: string | null = null;

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // CSP blocking third-party trackers (ads/analytics) is the CSP doing its job, not
    // an app bug — the browser logs it as console.error either way, in two different
    // phrasings per blocked request ("violates the following Content Security Policy
    // directive" and "Refused to connect because it violates the document's Content
    // Security Policy"). Filtered by mentioning CSP at all, not by domain allowlist, so
    // it stays correct even as new ad/analytics vendors get added or removed.
    if (/content security policy/i.test(text)) return;
    consoleErrors.push(text);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('response', (res) => {
    if (origin === null) {
      try {
        origin = new URL(page.url()).origin;
      } catch {
        return;
      }
    }
    if (res.status() >= 400 && res.url().startsWith(origin)) {
      failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });

  return {
    assertNoErrors() {
      expect(pageErrors, `Uncaught JS errors:\n${pageErrors.join('\n')}`).toHaveLength(0);
      expect(consoleErrors, `console.error chamado:\n${consoleErrors.join('\n')}`).toHaveLength(0);
      expect(
        failedRequests,
        `Requisicoes same-origin com erro (4xx/5xx):\n${failedRequests.join('\n')}`
      ).toHaveLength(0);
    },
  };
}
