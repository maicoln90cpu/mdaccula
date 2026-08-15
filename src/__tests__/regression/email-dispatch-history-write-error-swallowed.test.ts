/**
 * R-058 — A escrita final de histórico em create-event-email-campaign, no
 * caminho "campanha criada com sucesso na E-goi", nunca checava { error } do
 * Supabase-js. Uma falha de banco nesse ponto (RLS, constraint, etc.) ficava
 * completamente silenciosa: resposta 200, ok:true, zero linha gravada,
 * nenhum log — reproduzindo sozinha todos os sintomas do "dispatch_in_progress"
 * observado em produção pro evento Sirius em 10/08/2026, mesmo após R-052 a
 * R-057.
 *
 * Atualizado pelo R-062 (15/08/2026): a escrita final deixou de ser um
 * INSERT-ou-UPDATE condicional a `reuseRow` — agora é sempre um UPDATE por
 * `historyRowId`, porque a linha já existe desde a Fase 1 (gravada como
 * 'in_progress' antes de qualquer chamada à E-goi, ver
 * email-dispatch-in-progress-row-before-egoi-call.test.ts). O princípio do
 * R-058 continua valendo: `{ error }` do Supabase-js precisa ser checado e
 * logado, e uma falha aqui NUNCA libera o claim (a campanha real já existe
 * na E-goi nesse ponto).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-058/R-062 — erro de escrita do histórico de e-mail não é mais silencioso', () => {
  it('create-event-email-campaign captura e loga o erro da finalização (Fase 2) em event_email_campaigns', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const start = src.indexOf('// Persistência do histórico');
    expect(start, 'Não encontrei o bloco de persistência do histórico.').toBeGreaterThan(-1);
    const end = src.indexOf('return json({', start);
    const block = src.slice(start, end);

    expect(
      block,
      'A finalização precisa destructurar { error } de finalizeHistoryRow — Supabase-js não lança em erro ' +
        'de RLS/constraint, só retorna { error }.'
    ).toMatch(/const\s*\{\s*error:\s*finalizeError\s*\}\s*=\s*await finalizeHistoryRow\(admin, historyRowId, rowPayload\)/);
    expect(
      block,
      'Falha ao gravar histórico precisa ser logada via console.error, senão fica invisível nos logs da function.'
    ).toMatch(/console\.error\(['"]\[create-event-email-campaign\][^'"]*hist[oó]rico/i);
  });

  it('a resposta final soma o erro de histórico na mensagem devolvida ao admin', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const start = src.indexOf('// Persistência do histórico');
    const returnStart = src.indexOf('return json({', start);
    const returnBlock = src.slice(returnStart, src.indexOf('});', returnStart) + 3);

    expect(
      returnBlock,
      'O campo error da resposta precisa refletir uma eventual falha de histórico, não só o errorMessage puro da E-goi.'
    ).toMatch(/error:\s*(finalErrorMessage|historyError)/);
  });

  it('não libera o claim de disparo por causa de uma falha de histórico (a campanha real na E-goi já existe)', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const start = src.indexOf('// Persistência do histórico');
    const end = src.indexOf('return json({', start);
    const block = src.slice(start, end);

    expect(
      block,
      'O bloco de persistência do histórico não deve resetar email_campaign_dispatched_at — isso permitiria recriar/reenviar de verdade na E-goi em cima de uma campanha que já existe.'
    ).not.toMatch(/email_campaign_dispatched_at:\s*null/);
  });

  it('sibling create-multi-event-email-campaign mantém o mesmo padrão (regressão cruzada, referência de house style)', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    expect(
      src,
      'A finalização precisa destructurar { error } de finalizeHistoryRows — mesmo padrão do sibling single-event.'
    ).toMatch(/const\s*\{\s*error:\s*finalizeError\s*\}\s*=\s*await finalizeHistoryRows\(admin, historyRowIds, rowPayload\)/);
    expect(src).toMatch(/console\.error\(['"]\[create-multi-event-email-campaign\][^'"]*hist[oó]rico/i);
  });
});
