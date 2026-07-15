import type { Locator, Page } from '@playwright/test';
import { E2E_KNOWN_EVENT_SLUG } from '../../fixtures';

export type CloseAction = { kind: 'escape' } | { kind: 'button'; name: RegExp };

export interface ModalEntry {
  id: string;
  requiresAdmin: boolean;
  navigate: (page: Page) => Promise<void>;
  open: (page: Page) => Promise<void>;
  /** Locator for the opened surface, used for the "fits viewport" assertion. */
  surface: (page: Page) => Locator;
  /** MUST be Escape or a Cancel/Close-labeled button — never Save/Confirm/Delete. */
  close: CloseAction;
  /**
   * Set when the modal is only reachable under certain data/viewport conditions
   * (e.g. depends on a site_settings flag, a data flag on the known event fixture,
   * or a mobile-only breakpoint). When true, the spec skips (does not fail) if the
   * trigger/surface doesn't show up within a short timeout.
   */
  optional?: boolean;
  skipReason?: string;
  /**
   * Milliseconds to wait after the surface becomes visible before measuring its
   * geometry — needed for surfaces with a CSS entrance transition (e.g. the Radix
   * Sheet slide-in), where an immediate boundingBox() read would catch it mid-animation.
   */
  settleMs?: number;
}

export const MODALS: ModalEntry[] = [
  {
    id: 'newsletter-popup',
    requiresAdmin: false,
    optional: true,
    skipReason: 'Depends on site_settings.newsletter_popup_enabled being "true" — not guaranteed in every environment.',
    navigate: async (page) => {
      await page.addInitScript(() => {
        localStorage.removeItem('newsletter_popup_seen');
        localStorage.removeItem('newsletter_subscribed');
      });
      await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    },
    open: async (page) => {
      // Simulate the scroll-past-50% trigger instead of waiting the real 30s setTimeout.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.mouse.wheel(0, 100);
    },
    surface: (page) => page.getByRole('dialog').filter({ hasText: 'Fique por dentro' }),
    close: { kind: 'escape' },
  },
  {
    id: 'event-ticket-day-picker-modal',
    requiresAdmin: false,
    optional: true,
    skipReason: 'Only rendered when the known event fixture has tickets_per_day=true and a multi-day date range.',
    navigate: async (page) => page.goto(`/eventos/${E2E_KNOWN_EVENT_SLUG}`, { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: /comprar ingresso|ingresso/i }).first().click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-events-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/events', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Adicionar Evento' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-news-sources-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/news-sources', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Nova Fonte' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-team-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/team', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Adicionar Membro' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-links-group-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/links-manager', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Novo Grupo' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-links-link-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/links-manager', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Novo Link' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-redirects-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/redirects', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Novo Link' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-prompt-templates-create-dialog',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/ai-prompt-templates', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Novo Template' }).click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-sidebar-sheet',
    requiresAdmin: true,
    optional: true,
    skipReason: 'SidebarTrigger only opens a Sheet on mobile viewports (<768px) — on tablet/desktop it just toggles collapse, no dialog surface.',
    // Sheet slide-in transition is data-[state=open]:duration-500 (sheet.tsx) — wait
    // for it to settle before measuring geometry, or boundingBox() catches it mid-slide.
    settleMs: 600,
    navigate: async (page) => page.goto('/admin', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.locator('[data-sidebar="trigger"]').click({ timeout: 8_000 }),
    surface: (page) => page.getByRole('dialog'),
    close: { kind: 'escape' },
  },
  {
    id: 'admin-redirects-date-range-popover',
    requiresAdmin: true,
    navigate: async (page) => page.goto('/admin/redirects', { waitUntil: 'domcontentloaded' }),
    open: async (page) => page.getByRole('button', { name: 'Todo período' }).click({ timeout: 8_000 }),
    surface: (page) => page.locator('[data-radix-popper-content-wrapper]'),
    close: { kind: 'escape' },
  },
];

// Explicitly excluded, not silently omitted — surfaced in test output via test.skip(true, reason).
export const SKIPPED_MODALS: { id: string; reason: string }[] = [
  {
    id: 'alert-dialogs-all',
    reason:
      'AlertDialog destructive-confirm dialogs (delete event/post/link/team member/etc., 11 files) require ' +
      'an existing row and E2E authenticates against the production Supabase project — excluded from ' +
      'automated interaction. Re-enable only if a maintainer provides a disposable, clearly-named fixture ' +
      'row per table.',
  },
  {
    id: 'event-modal-public',
    reason:
      'src/components/events/EventModal.tsx is rendered in src/pages/Eventos.tsx but showEventModal is never ' +
      'set to true in that file — event card clicks navigate to /eventos/:slug instead. The modal appears ' +
      'unreachable via the current public UI; excluded until confirmed reachable.',
  },
  {
    id: 'admin-data-dependent-dialogs',
    reason:
      'PodcastManager (submission details), NewsletterABResults (edit variant) and NewsletterManager ' +
      '(mass-email, button disabled with zero confirmed subscribers) only open when an existing row/data ' +
      'is present — excluded from the registry-driven crawl to avoid depending on production data state.',
  },
  {
    id: 'blog-manager-and-event-templates-forms',
    reason:
      '"Novo Post" (BlogManager) and "Novo Template" (EventTemplates) render their form inline on the page, ' +
      'not inside a Dialog — not a modal, so out of scope for this registry. The page itself is already ' +
      'covered by route-crawl.spec.ts.',
  },
];
