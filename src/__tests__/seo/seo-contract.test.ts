import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic imports keep Node builtins out of Vite's browser build graph.
let readFileSync: typeof import('fs').readFileSync;
let existsSync: typeof import('fs').existsSync;
let resolve: typeof import('path').resolve;
let ROOT = '';

const PRIVATE_ROUTES = ['/admin', '/login', '/auth', '/reset', '/settings'];

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  const path = await import(/* @vite-ignore */ 'path');
  readFileSync = fs.readFileSync;
  existsSync = fs.existsSync;
  resolve = path.resolve;
  ROOT = process.cwd();
});

describe('SEO - robots.txt', () => {
  it('existe', () => {
    expect(existsSync(resolve(ROOT, 'public/robots.txt'))).toBe(true);
  });

  it('não bloqueia o site inteiro sob User-agent: *', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
    const blocks = robots.split(/\n(?=User-agent:)/);
    const wildcard = blocks.find((b) => /^User-agent:\s*\*/m.test(b));
    expect(wildcard, 'esperado um bloco User-agent: *').toBeDefined();
    const lines = wildcard!.split('\n').map((l) => l.trim());
    expect(lines).not.toContain('Disallow: /');
  });

  it('tem diretiva Sitemap apontando para mdaccula.com', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
    expect(robots).toMatch(/Sitemap:\s*https:\/\/mdaccula\.com\/sitemap\.xml/);
  });

  it('bloqueia /admin', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
    expect(robots).toMatch(/Disallow:\s*\/admin/);
  });
});

describe('SEO - sitemap.xml', () => {
  it('existe', () => {
    expect(existsSync(resolve(ROOT, 'public/sitemap.xml'))).toBe(true);
  });

  it('não contém rotas privadas', () => {
    const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf-8');
    for (const route of PRIVATE_ROUTES) {
      expect(
        sitemap,
        `sitemap não deve conter rota privada ${route}`,
      ).not.toMatch(new RegExp(`<loc>[^<]*${route}(/|<)`));
    }
  });

  it('todas as URLs usam https://mdaccula.com', () => {
    const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf-8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).toMatch(/^https:\/\/mdaccula\.com/);
    }
  });
});

describe('SEO - llms.txt', () => {
  it('existe em public/', () => {
    expect(existsSync(resolve(ROOT, 'public/llms.txt'))).toBe(true);
  });
});

describe('SEO - páginas privadas usam noindex via SEOHead', () => {
  const privatePages = [
    'src/pages/Auth.tsx',
    'src/pages/Login.tsx',
    'src/pages/NotFound.tsx',
  ];

  for (const page of privatePages) {
    it(`${page} usa <SEOHead ... noindex />`, () => {
      const src = readFileSync(resolve(ROOT, page), 'utf-8');
      expect(src).toMatch(/SEOHead/);
      expect(src).toMatch(/noindex/);
    });
  }
});
