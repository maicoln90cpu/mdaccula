/**
 * R-058 — A escrita final de histórico (insert/update em
 * event_email_campaigns) em create-event-email-campaign, no caminho "campanha
 * criada com sucesso na E-goi", nunca checava { error } do Supabase-js. Uma
 * falha de banco nesse ponto (RLS, constraint, etc.) ficava completamente
 * silenciosa: resposta 200, ok:true, zero linha gravada, nenhum log —
 * reproduzindo sozinha todos os sintomas do "dispatch_in_progress" observado
 * em produção pro evento Sirius em 10/08/2026, mesmo após R-052 a R-057.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-058 — erro de escrita do histórico de e-mail não é mais silencioso', () => {
  it('create-event-email-campaign captura e loga o erro do update/insert final em event_email_campaigns', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const start = src.indexOf('// Persistência do histórico');
    expect(start, 'Não encontrei o bloco de persistência do histórico.').toBeGreaterThan(-1);
    const end = src.indexOf('return json({', start);
    const block = src.slice(start, end);

    expect(
      block,
      'O update encadeado precisa destructurar { error } — Supabase-js não lança em erro de RLS/constraint, só retorna { error }.'
    ).toMatch(/const\s*\{\s*error:\s*updateError\s*\}\s*=\s*await admin[\s\S]*?\.update\(rowPayload\)/);
    expect(
      block,
      'O insert encadeado precisa destructurar { error } — mesmo motivo.'
    ).toMatch(/const\s*\{\s*error:\s*insertError\s*\}\s*=\s*await admin[\s\S]*?\.insert\(rowPayload\)/);
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
    expect(src).toMatch(/const\s*\{\s*error:\s*insertError\s*\}\s*=\s*await admin[\s\S]*?\.insert\(rows\)/);
  });
});
