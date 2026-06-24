/**
 * Contract test — Edge Function `indexnow-notify`.
 *
 * Garante que o contrato HTTP da função se mantém: CORS preflight,
 * GET expõe a chave em text/plain, POST sem URLs retorna 400, método
 * inválido retorna 405. Não testamos integração com api.indexnow.org
 * — só o nosso lado do contrato.
 *
 * Roda contra a Edge Function REAL (via VITE_SUPABASE_URL). Se a env
 * não estiver presente (PR sem secrets, dev local sem .env), os testes
 * são automaticamente pulados — nunca falham por falta de configuração.
 *
 * Para rodar localmente: `VITE_SUPABASE_URL=... npm test`.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/indexnow-notify` : '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';

describe.skipIf(!SUPABASE_URL)('Contract: indexnow-notify', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text(); // evita resource leak
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('GET expõe a chave IndexNow em text/plain', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {},
    });
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(body.trim().length).toBeGreaterThan(8);
  });

  it('POST sem urls válidas retorna 400 com envelope { ok:false, error }', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
      },
      body: JSON.stringify({ urls: [] }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ ok: false });
    expect(typeof body.error).toBe('string');
  });

  it('PUT (método não suportado) retorna 405', async () => {
    const res = await fetch(FN_URL, {
      method: 'PUT',
      headers: ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {},
    });
    await res.text();
    expect(res.status).toBe(405);
  });
});
