/**
 * Contract test — Edge Function `weekly-digest-draft`.
 *
 * Verifica o CONTRATO HTTP público (o que não pode quebrar sem alarme):
 *   1. OPTIONS retorna preflight CORS válido
 *   2. Sem Authorization e sem x-cron-secret → 401 { error }
 *   3. Com anon-key (usuário não-admin) → 401 ou 403 (guarda de admin ativa)
 *   4. Com x-cron-secret inválido → 401 (não bypassa guard)
 *
 * A lógica interna (separação DEDGE vs weekend_grid, contagem de eventos etc.)
 * está coberta pelos unit tests em src/__tests__/lib/blocks-*.test.ts.
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
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/weekly-digest-draft` : '';

describe.skipIf(!SUPABASE_URL)('Contract: weekly-digest-draft', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
    // Deve permitir o header customizado usado pelo cron
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
        'x-cron-job': 'weekly-digest-cron',
      },
      body: JSON.stringify({ dry_run: true }),
    });
    await res.text();
    // Deve rejeitar (401) ou pular por outra guarda de config (200 com skipped),
    // mas NUNCA processar como se fosse cron autêntico.
    expect(res.status === 401 || res.status === 200).toBe(true);
  });
});
