/// <reference types="node" />
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const PRIVATE_ROUTES = ['/admin', '/login', '/auth', '/reset', '/settings'];

describe('SEO - robots.txt', () => {
  const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');

  it('existe', () => {
    expect(existsSync(resolve(ROOT, 'public/robots.txt'))).toBe(true);
  });

  it('não bloqueia o site inteiro (sem "Disallow: /" global)', () => {
    const lines = robots.split('\n').map((l) => l.trim());
    expect(lines).not.toContain('Disallow: /');
  });

  it('tem diretiva Sitemap apontando para mdaccula.com', () => {
    expect(robots).toMatch(/Sitemap:\s*https:\/\/mdaccula\.com\/sitemap\.xml/);
  });

  it('bloqueia /admin', () => {
    expect(robots).toMatch(/Disallow:\s*\/admin/);
  });
});

describe('SEO - sitemap.xml', () => {
  const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf-8');

  it('existe', () => {
    expect(existsSync(resolve(ROOT, 'public/sitemap.xml'))).toBe(true);
  });

  it('não contém rotas privadas', () => {
    for (const route of PRIVATE_ROUTES) {
      expect(
        sitemap,
        `sitemap não deve conter rota privada ${route}`,
      ).not.toMatch(new RegExp(`<loc>[^<]*${route}(/|<)`));
    }
  });

  it('todas as URLs usam https://mdaccula.com', () => {
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
