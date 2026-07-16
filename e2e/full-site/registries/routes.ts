import type { Page } from '@playwright/test';
import { E2E_KNOWN_EVENT_SLUG } from '../../fixtures';

export interface RouteEntry {
  /** Stable key, used in test titles. */
  id: string;
  requiresAdmin: boolean;
  /** Static path to navigate to. Omit when `discover` is provided instead. */
  path?: string;
  /** For routes with no fixed slug: navigate and return the concrete URL to visit. */
  discover?: (page: Page) => Promise<string>;
}

// Public routes — mirrors src/App.tsx. /links/:slug and /r/:slug are intentionally
// excluded: no fixture slug is documented for either today (see docs/TESTING.md gaps).
export const PUBLIC_ROUTES: RouteEntry[] = [
  { id: 'home', requiresAdmin: false, path: '/' },
  { id: 'eventos', requiresAdmin: false, path: '/eventos' },
  { id: 'evento-detail', requiresAdmin: false, path: `/eventos/${E2E_KNOWN_EVENT_SLUG}` },
  { id: 'quem-somos', requiresAdmin: false, path: '/quem-somos' },
  { id: 'contato', requiresAdmin: false, path: '/contato' },
  { id: 'login', requiresAdmin: false, path: '/login' },
  { id: 'auth', requiresAdmin: false, path: '/auth' },
  { id: 'blog', requiresAdmin: false, path: '/blog' },
  {
    id: 'blog-post',
    requiresAdmin: false,
    discover: async (page) => {
      await page.goto('/blog', { waitUntil: 'domcontentloaded' });
      const href = await page.locator('a[href^="/blog/"]').first().getAttribute('href');
      if (!href) throw new Error('No blog post link found on /blog to discover /blog/:slug');
      return href;
    },
  },
  { id: 'busca', requiresAdmin: false, path: '/busca' },
  { id: 'radio', requiresAdmin: false, path: '/MDAcculaRadio' },
  { id: 'podcast-redirect', requiresAdmin: false, path: '/podcast' },
  { id: 'analytics', requiresAdmin: false, path: '/analytics' },
  { id: 'privacidade', requiresAdmin: false, path: '/privacidade' },
  { id: 'links', requiresAdmin: false, path: '/links' },
  { id: 'not-found', requiresAdmin: false, path: '/this-route-does-not-exist-e2e' },
];

// Admin routes under AdminLayout — mirrors src/App.tsx nested <Route> segments.
const ADMIN_SEGMENTS = [
  '',
  'events',
  'events-dashboard',
  'event-templates',
  'blog',
  'fontes',
  'ai-content2',
  'team',
  'settings',
  'links-manager',
  'links-analytics',
  'newsletter-ab-results',
  'newsletter',
  'system-health',
  'recurring-events',
  'mdaccula-radio',
  'redirects',
  'data-import',
  'egress-monitor',
  'email-preview',
  'email-config',
];

export const ADMIN_ROUTES: RouteEntry[] = ADMIN_SEGMENTS.map((segment) => ({
  id: `admin-${segment || 'index'}`,
  requiresAdmin: true,
  path: `/admin${segment ? `/${segment}` : ''}`,
}));

export const ALL_ROUTES: RouteEntry[] = [...PUBLIC_ROUTES, ...ADMIN_ROUTES];
