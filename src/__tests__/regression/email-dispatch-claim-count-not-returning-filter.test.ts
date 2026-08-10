/**
 * R-059 — Causa raiz definitiva do "dispatch_in_progress" persistente:
 * o claim atômico (`events.email_campaign_dispatched_at`) sempre travava a
 * linha de verdade no banco (confirmado via SQL bruto: `UPDATE ... WHERE
 * col IS NULL OR col < X` afeta 1 linha real), mas o jeito que o código
 * detectava sucesso — `.update({col: now}).or('col.is.null,col.lt.X').select().maybeSingle()`
 * — NUNCA via essa linha: o PostgREST reaplica o WHERE do UPDATE sobre o
 * RETURNING antes de devolver as linhas, e como esse WHERE testa a PRÓPRIA
 * coluna que o UPDATE acabou de sobrescrever, a condição (`IS NULL` OU
 * `< staleClaimBefore`) nunca é verdadeira contra o valor novo (que é o
 * timestamp "agora", nem null nem velho). `.select()` devolvia sempre vazio,
 * `.maybeSingle()` devolvia null, e o código concluía "perdi a corrida" —
 * TODO disparo manual (forceResend sempre true nesse fluxo), mesmo sem
 * nenhuma corrida real.
 *
 * Corrigido usando `count: 'exact'` (sem `.select()` encadeado): o Postgres
 * calcula esse count a partir das linhas realmente afetadas pelo UPDATE
 * (semântica normal, não sujeita ao refiltro do RETURNING). Uma leitura
 * separada, depois, descobre os detalhes (title/status, ou — no caso
 * multi-evento — exatamente quais IDs foram claimados, comparando o valor
 * exato de `now` gravado).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-059 — claim do disparo usa count real do UPDATE, não RETURNING refiltrado', () => {
  it('create-event-email-campaign: usa count:"exact" e testa !claimCount, não .maybeSingle()', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    expect(src).toContain("{ count: 'exact' }");
    expect(
      src,
      'O bloco do claim precisa checar !claimCount (não !claimed) pra decidir dispatch_in_progress/already_dispatched.'
    ).toMatch(/if\s*\(!claimCount\)/);
  });

  it('create-event-email-campaign: busca title/status numa leitura separada, após vencer o claim', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const idx = src.indexOf('if (!claimCount)');
    expect(idx).toBeGreaterThan(-1);
    const after = src.slice(idx, idx + 800);
    expect(after).toMatch(/\.select\('id,title,status'\)/);
  });

  it('create-multi-event-email-campaign: usa count:"exact" no UPDATE do claim, sem .select() encadeado', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    expect(src).toContain("{ count: 'exact' }");
  });

  it('create-multi-event-email-campaign: descobre os IDs claimados comparando o valor exato de `now`', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    expect(
      src,
      'Precisa filtrar as linhas lidas de volta pelo valor exato de `now` pra saber quais foram claimadas por ESTA requisição.'
    ).toMatch(/email_campaign_dispatched_at\s*===\s*now/);
  });
});
