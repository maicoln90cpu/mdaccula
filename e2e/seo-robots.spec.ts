import { test, expect } from '@playwright/test';

/**
 * Protege robots.txt contra regressão: garante que o Sitemap aponta
 * para o domínio canônico (mdaccula.com) e que /admin permanece bloqueado.
 */
test.describe('SEO: robots.txt', () => {
  test('contém Sitemap canônico e bloqueia /admin', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBeLessThan(400);
    const body = await res.text();

    expect(body).toMatch(/Sitemap:\s*https:\/\/mdaccula\.com\/sitemap\.xml/i);
    expect(body).toMatch(/Disallow:\s*\/admin/i);
  });

  test('sitemap.xml responde com XML válido', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('https://mdaccula.com/');
  });
});
