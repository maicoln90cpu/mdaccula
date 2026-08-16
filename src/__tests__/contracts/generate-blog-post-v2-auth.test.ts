/**
 * Contract test — Edge Function `generate-blog-post-v2` (auth).
 *
 * Gera artigo de blog via IA (custo real) e publica no banco via
 * service_role — antes desta correção não tinha NENHUMA checagem de auth no
 * código (achado na auditoria de 15-16/08/2026, ver docs/PENDENCIAS.md,
 * Fase 4 de 8). Verifica só o CONTRATO de autenticação (o comportamento de
 * geração em si já é coberto por outros contract/regression tests deste
 * diretório):
 *   1. OPTIONS retorna preflight CORS válido
 *   2. Sem Authorization → 401 { error }
 *   3. Com anon-key (usuário não-admin) → 401 ou 403 (guarda de admin ativa)
 *
 * NÃO testa o caminho de chamada interna (scan-event-sources/
 * apify-instagram-webhook usando a SUPABASE_SERVICE_ROLE_KEY como Bearer,
 * via authorizeAdminOrCron(..., { allowServiceRole: true })) — a service
 * key nunca deve aparecer num arquivo versionado, nem de teste.
 *
 * IMPORTANTE: só rodar este arquivo contra a function JÁ DEPLOYADA com a
 * correção — rodar antes do deploy, contra a function ainda sem guarda,
 * dispara geração real por IA (aconteceu de verdade na Fase 4: 6 posts de
 * teste chegaram a ser publicados de verdade antes de serem apagados).
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
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/generate-blog-post-v2` : '';

describe.skipIf(!SUPABASE_URL)('Contract: generate-blog-post-v2 (auth)', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('Sem auth → 401 com JSON de erro (nunca dispara geração)', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'teste' }),
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
      body: JSON.stringify({ eventName: 'teste' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
