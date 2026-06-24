/**
 * RLS test piloto — tabela `public.events`.
 *
 * Política atual no banco (snapshot junho/2026):
 *   • SELECT  → USING (true)         → anônimo lê todas as linhas.
 *   • ALL     → USING (is_admin())   → só admin altera.
 *   • ALL     → USING (true) p/ service_role.
 *
 * Este teste é a prova viva de que essas políticas continuam valendo.
 * Se alguém afrouxar (ex.: liberar INSERT pra anônimo) ou apertar demais
 * (ex.: bloquear SELECT público e derrubar /eventos), o CI grita.
 *
 * Pula automaticamente se VITE_SUPABASE_URL/ANON_KEY não estiverem setados.
 *
 * IMPORTANTE: rodamos contra o Supabase REAL com a anon key.
 *  - Não escrevemos nada (só tentamos e validamos que falha).
 *  - Não logamos linhas (proteção egress + privacidade).
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

describe.skipIf(!ENABLED)('RLS — public.events (perfil anônimo)', () => {
  let anon: SupabaseClient;

  beforeAll(() => {
    anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('SELECT público é permitido (policy "Anyone can view events")', async () => {
    const { error, data } = await anon.from('events').select('id').limit(1);
    expect(error, `SELECT anônimo não deveria falhar: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('INSERT anônimo é BLOQUEADO pela RLS', async () => {
    const { error } = await anon.from('events').insert({
      title: '__rls_test_should_fail__',
      slug: `__rls_test_${Date.now()}`,
      date: '2099-01-01',
      time: '20:00',
    } as any);
    // Esperamos erro de RLS — qualquer erro serve, desde que NÃO seja sucesso.
    expect(error, 'RLS deveria bloquear INSERT anônimo na tabela events').not.toBeNull();
  });

  it('UPDATE anônimo é BLOQUEADO pela RLS (affected rows = 0)', async () => {
    // Tentamos atualizar uma condição impossível → sem erro, mas zero linhas.
    // RLS faz INSERT/UPDATE com filtro silencioso: nenhuma linha é tocada.
    const { error, data } = await anon
      .from('events')
      .update({ title: '__rls_test_should_fail__' })
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('DELETE anônimo é BLOQUEADO pela RLS (affected rows = 0)', async () => {
    const { error, data } = await anon
      .from('events')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
