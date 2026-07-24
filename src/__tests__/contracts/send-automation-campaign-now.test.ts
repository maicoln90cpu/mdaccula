/**
 * Contract test — Edge Function `send-automation-campaign-now`.
 *
 * Só aceita JWT de admin (sem bypass de cron real), então sem credenciais de
 * teste só dá pra verificar a camada de auth/CORS por rede — validação de
 * corpo (egoi_campaign_id obrigatório) está coberta na revisão de código
 * (mesma limitação de create-event-event-email-campaign.test.ts).
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
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/send-automation-campaign-now` : '';

describe.skipIf(!SUPABASE_URL)('Contract: send-automation-campaign-now', () => {
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
      body: JSON.stringify({ egoi_campaign_id: 'x' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
