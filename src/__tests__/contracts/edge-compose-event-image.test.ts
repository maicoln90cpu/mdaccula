/**
 * Contract test — Edge Function `compose-event-image`.
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/compose-event-image` : '';

describe.skipIf(!SUPABASE_URL)('Contract: compose-event-image', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('imageUrl ausente → 400 com JSON de erro', async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ title: 'teste' }),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('title ausente → 400 com JSON de erro', async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ imageUrl: 'https://mdaccula.com/logo-mdaccula.jpeg' }),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('imagem base inválida/inacessível → 200 com fallback (composed:false, imageUrl original)', async () => {
    if (!ANON_KEY) return;
    const brokenUrl = 'https://mdaccula.com/nao-existe-de-verdade.jpg';
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ imageUrl: brokenUrl, title: 'teste' }),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, composed: false, imageUrl: brokenUrl });
  });
});
