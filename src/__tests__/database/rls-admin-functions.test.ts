/**
 * Prova viva: funções administrativas do banco NÃO podem ser executadas
 * por visitante anônimo, e os buckets públicos NÃO permitem listagem.
 *
 * Contexto (agosto/2026): o advisor do Supabase apontou que `get_db_size`,
 * `cleanup_old_logs` e `cleanup_old_egress` eram chamáveis via /rest/v1/rpc
 * por qualquer visitante, e que os 3 buckets de imagem permitiam listar
 * todo o conteúdo. Corrigido por migração — este teste impede a regressão.
 *
 * Pula automaticamente se VITE_SUPABASE_URL/ANON_KEY não estiverem setados.
 * Não escreve nada: só tenta e valida que falha.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';

const ENABLED = Boolean(SUPABASE_URL && ANON_KEY);

const ADMIN_FUNCTIONS = ['get_db_size', 'cleanup_old_logs', 'cleanup_old_egress'] as const;
const PUBLIC_BUCKETS = ['event-images', 'link-thumbnails', 'team-images'] as const;

describe.skipIf(!ENABLED)('Segurança — superfície administrativa (perfil anônimo)', () => {
  let anon: SupabaseClient;

  beforeAll(() => {
    anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it.each(ADMIN_FUNCTIONS)('RPC %s é negada para anônimo', async (fn) => {
    const { error } = await anon.rpc(fn as never);
    expect(error).not.toBeNull();
  });

  it.each(PUBLIC_BUCKETS)('bucket %s não permite listagem anônima', async (bucket) => {
    const { data, error } = await anon.storage.from(bucket).list('', { limit: 5 });
    // Ou erro explícito, ou lista vazia (RLS filtra todas as linhas).
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
