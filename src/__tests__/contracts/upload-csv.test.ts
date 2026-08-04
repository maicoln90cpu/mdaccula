/**
 * Contract test — Edge Function `upload-csv`.
 *
 * Faz upload de um CSV bruto pro bucket de Storage (passo anterior ao
 * import-csv-data) — antes desta correção não tinha NENHUMA checagem de auth
 * no código (achado na auditoria de 03/08/2026, ver docs/PENDENCIAS.md).
 * Verifica o CONTRATO HTTP público:
 *   1. OPTIONS retorna preflight CORS válido
 *   2. Sem Authorization → 401 { error }
 *   3. Com anon-key (usuário não-admin) → 401 ou 403 (guarda de admin ativa)
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
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/upload-csv` : '';

describe.skipIf(!SUPABASE_URL)('Contract: upload-csv', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('Sem auth → 401 com JSON de erro (nunca grava no Storage)', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'probe.csv', content: 'a,b\n1,2' }),
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
      body: JSON.stringify({ filename: 'probe.csv', content: 'a,b\n1,2' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
