/**
 * Contract test — Edge Function `regenerate-blog-image` (auth).
 *
 * Gera uma imagem via IA (custo real, inclui upload pro Bunny) e sobrescreve
 * `blog_posts.image_url` via service_role — antes desta correção não tinha
 * NENHUMA checagem de auth no código (achado na auditoria de 15-16/08/2026,
 * ver docs/PENDENCIAS.md, Fase 5 de 8). Verifica só o CONTRATO de
 * autenticação:
 *   1. OPTIONS retorna preflight CORS válido
 *   2. Sem Authorization → 401 { error }
 *   3. Com anon-key (usuário não-admin) → 401 ou 403 (guarda de admin ativa)
 *
 * IMPORTANTE (lição da Fase 4): só rodar este arquivo contra a function JÁ
 * DEPLOYADA com a correção — antes do deploy, contra a function ainda sem
 * guarda, dispara geração real por IA (aconteceu de verdade: 6 posts de
 * teste chegaram a ser publicados e precisaram ser apagados manualmente).
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
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/regenerate-blog-image` : '';

describe.skipIf(!SUPABASE_URL)('Contract: regenerate-blog-image (auth)', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('Sem auth → 401 com JSON de erro (nunca gera imagem)', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: '00000000-0000-0000-0000-000000000000' }),
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
      body: JSON.stringify({ postId: '00000000-0000-0000-0000-000000000000' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
