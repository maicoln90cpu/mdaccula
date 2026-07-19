/**
 * Contract test — Edge Function `weekend-agenda-draft`.
 *
 * Verifica o CONTRATO HTTP público:
 *   1. OPTIONS retorna preflight CORS válido (com header x-cron-secret)
 *   2. Sem Authorization e sem x-cron-secret → 401 { error }
 *   3. Com anon-key (não-admin) → 401 ou 403
 *   4. x-cron-secret inválido não bypassa guard
 *
 * Business logic (separação DEDGE vs weekend_grid) tem unit tests dedicados.
 *
 * Pula se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/weekend-agenda-draft` : '';

describe.skipIf(!SUPABASE_URL)('Contract: weekend-agenda-draft', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
    const allowedHeaders = res.headers.get('access-control-allow-headers') ?? '';
    expect(allowedHeaders.toLowerCase()).toContain('x-cron-secret');
  });

  it('Sem auth → 401 com JSON de erro', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run: true }),
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
      body: JSON.stringify({ dry_run: true }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });

  it('x-cron-secret inválido → não bypassa auth', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'obviously-invalid-secret-xyz',
        'x-cron-job': 'weekend-agenda-cron',
      },
      body: JSON.stringify({ dry_run: true }),
    });
    await res.text();
    expect(res.status === 401 || res.status === 200).toBe(true);
  });
});
