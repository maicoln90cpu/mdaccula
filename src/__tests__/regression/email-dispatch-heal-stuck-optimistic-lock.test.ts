/**
 * R-062 — heal-stuck-email-dispatches finaliza linhas "in_progress" abandonadas
 * e libera o claim do evento correspondente. Isso precisa usar um lock
 * otimista (ler primeiro, depois UPDATE por id + updated_at exato, com
 * `count: 'exact'`) — NUNCA um único UPDATE...WHERE updated_at < X encadeado
 * com `.select()`, porque o PostgREST reaplica esse WHERE sobre o RETURNING
 * depois do UPDATE já ter mudado `updated_at` pra `now()` (via trigger),
 * fazendo a condição `< X` nunca bater contra o valor novo — exatamente a
 * causa raiz do R-059, que já enganou o time uma vez nesse mesmo projeto.
 * Sem esse cuidado, o poller também corre o risco de atropelar um reenvio
 * manual concorrente que reaproveitou a mesma linha entre a leitura e a
 * escrita.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-062 — heal-stuck-email-dispatches usa lock otimista, não UPDATE...WHERE updated_at < X com .select()', () => {
  const src = read('supabase/functions/heal-stuck-email-dispatches/index.ts');

  it('lê as linhas presas primeiro (SELECT), antes de qualquer UPDATE', () => {
    const selectIdx = src.indexOf(".select('id, event_id, updated_at')");
    const updateIdx = src.indexOf("update({ status: 'failed'");
    expect(selectIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(-1);
    expect(selectIdx).toBeLessThan(updateIdx);
  });

  it('finaliza cada linha usando count:"exact" + eq(updated_at) — nunca .select() encadeado no UPDATE de finalização', () => {
    const updateIdx = src.indexOf("update({ status: 'failed'");
    const block = src.slice(updateIdx, updateIdx + 400);
    expect(block, 'O UPDATE de finalização precisa usar { count: "exact" }.').toMatch(/\{\s*count:\s*'exact'\s*\}/);
    expect(
      block,
      'O UPDATE de finalização precisa comparar updated_at exato (lock otimista) — sem isso, um reenvio ' +
        'manual concorrente que reaproveitou a linha pode ser atropelado.'
    ).toMatch(/\.eq\('updated_at', row\.updated_at\)/);
    expect(
      block,
      'Nunca encadear .select() nesse UPDATE — mesmo bug do R-059 (RETURNING refiltrado pelo próprio WHERE).'
    ).not.toMatch(/\.select\(/);
  });

  it('só libera o claim do evento quando count confirma que a linha foi realmente atualizada por este poller', () => {
    const idx = src.indexOf('if (!count)');
    expect(idx, 'Precisa checar !count antes de considerar a linha "curada".').toBeGreaterThan(-1);
    const releaseIdx = src.indexOf('eventIdsToRelease.push');
    expect(releaseIdx).toBeGreaterThan(idx);
  });

  it('usa HISTORY_IN_PROGRESS_STALE_MS do módulo compartilhado como limiar de "abandonado" (fonte única de verdade)', () => {
    expect(src).toMatch(/from ['"]\.\.\/_shared\/emailDispatchHistory\.ts['"]/);
    expect(src).toMatch(/HISTORY_IN_PROGRESS_STALE_MS/);
  });
});
