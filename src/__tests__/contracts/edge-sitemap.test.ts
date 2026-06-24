/**
 * Contract test — Edge Function `sitemap`.
 *
 * Garante que a função continua respondendo XML válido de sitemap em GET
 * e CORS preflight em OPTIONS. Não testamos conteúdo (URLs do banco)
 * — só o contrato HTTP.
 *
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/sitemap` : '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';

describe.skipIf(!SUPABASE_URL)('Contract: sitemap', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('GET retorna XML de sitemap', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {},
    });
    const body = await res.text();

    expect(res.status).toBe(200);
    // Nota: o content-type pode chegar como text/plain dependendo do cliente HTTP
    // (Cloudflare faz content negotiation). Validamos o CORPO, que é a verdade.
    expect(body).toContain('<?xml');
    expect(body).toContain('<urlset');
    expect(body).toContain('sitemaps.org/schemas/sitemap');
    // Pelo menos uma URL listada
    expect(body).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/);
  });
});
