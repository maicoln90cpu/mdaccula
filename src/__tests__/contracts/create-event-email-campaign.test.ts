/**
 * Contract test — Edge Function `create-event-email-campaign`.
 *
 * Esta função só aceita JWT de admin (sem bypass de cron), então sem
 * credenciais de teste só dá pra verificar a camada de auth/CORS por rede —
 * a validação de corpo (event_id/html obrigatórios, schedule_at inválido,
 * schedule_at + send_now mutuamente exclusivos) está coberta estaticamente
 * em src/__tests__/regression/scheduled-send-false-success-on-draft.test.ts,
 * já que exercitá-la de verdade exigiria passar da guarda de admin.
 *
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/create-event-email-campaign` : '';

describe.skipIf(!SUPABASE_URL)('Contract: create-event-email-campaign', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('Sem auth → 401 com JSON de erro', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(401);
    expect(body).toHaveProperty('error');
  });

  it('Anon-key (não-admin) → guard rejeita (401 ou 403)', async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ event_id: 'x', html: '<p>x</p>' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
