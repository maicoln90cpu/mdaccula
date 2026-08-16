/**
 * Contract test — Edge Function `compose-event-image` (auth).
 *
 * Aplica marca MDAccula sobre imagens de evento — antes desta correção não tinha
 * NENHUMA checagem de auth no código (achado na auditoria de admin-auth, ver
 * docs/PENDENCIAS.md). Verifica só o CONTRATO de autenticação:
 *   1. OPTIONS retorna preflight CORS válido
 *   2. Sem Authorization → 401 { error }
 *   3. Com anon-key (usuário não-admin) → 401 ou 403 (guarda ativa)
 *
 * NÃO testa o caminho de chamada interna (scan-event-sources/
 * apify-instagram-webhook usando a SUPABASE_SERVICE_ROLE_KEY como Bearer) nem o
 * caminho de admin logado (botão "Teste manual de marca" em /admin/settings) —
 * a service key nunca deve aparecer num arquivo versionado, nem de teste, e um
 * JWT de admin real não é algo que dê pra fixar num teste automatizado. O
 * comportamento de composição em si (validação de campos, fallback de imagem
 * quebrada) deixou de ser testável via HTTP com a anon key depois desta correção
 * — só validável manualmente, logado como admin, em /admin/settings.
 *
 * IMPORTANTE: só passa contra a function JÁ DEPLOYADA com esta correção — rodado
 * contra o deploy anterior (sem guarda), os 2 últimos casos recebem 200 em vez de
 * 401/403 (sem efeito colateral perigoso aqui, diferente da geração por IA: só
 * confirma que a auth ainda não subiu).
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
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/compose-event-image` : '';

describe.skipIf(!SUPABASE_URL)('Contract: compose-event-image (auth)', () => {
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
      body: JSON.stringify({ imageUrl: 'https://mdaccula.com/logo-mdaccula.jpeg', title: 'teste' }),
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
      body: JSON.stringify({ imageUrl: 'https://mdaccula.com/logo-mdaccula.jpeg', title: 'teste' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
