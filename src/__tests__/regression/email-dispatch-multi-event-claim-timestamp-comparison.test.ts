/**
 * R-065 — 15/08/2026, reproduzido em produção pelo usuário duas vezes (via
 * navegador real, não só via automação): disparo de "Virada de lote"
 * (múltiplos eventos) pra Music ON + One Life sempre retornava 409 "Um ou
 * mais eventos já têm campanha disparada", mesmo logo depois do R-062/R-064
 * já estarem no ar. Causa raiz: create-multi-event-email-campaign descobria
 * quais eventos tinha reivindicado comparando, por igualdade estrita de
 * string, o timestamp devolvido pelo PostgREST (formato
 * "2026-08-15T21:06:08.83+00:00" — offset "+00:00", ms sem zero à direita)
 * contra o `now` gerado em JS via toISOString() (formato
 * "2026-08-15T21:06:08.830Z" — sempre "Z", sempre 3 dígitos de ms). Essas
 * duas strings nunca são iguais pro mesmo instante — então essa comparação
 * NUNCA era verdadeira, pra nenhuma chamada, desde que o recurso existe
 * (confirmado: event_email_campaigns nunca teve uma linha sequer com
 * campaign_type = 'multi_event'). O UPDATE do claim sempre reivindicava os
 * eventos de verdade, mas o código sempre concluía "reivindiquei zero",
 * devolvia 409, e como o release de claim parcial só roda se
 * claimedIds.length > 0, a reserva ficava presa pra sempre — o mesmo
 * sintoma do R-055/R-057/R-058/R-059/R-062, só que por uma causa nova e
 * 100% determinística, isolada nesse arquivo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-065 — claim de multi-evento compara timestamp por valor, não por string', () => {
  const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');

  it('não usa mais igualdade estrita de string contra o "now" pra decidir quais eventos foram reivindicados', () => {
    expect(
      src,
      'e.email_campaign_dispatched_at === now nunca é verdadeiro (PostgREST usa "+00:00" e ms sem zero à ' +
        'direita, toISOString() usa "Z" e sempre 3 dígitos) — reintroduz o bug que trava a reserva pra sempre.'
    ).not.toMatch(/email_campaign_dispatched_at\s*===\s*now\b/);
  });

  it('compara o timestamp reivindicado usando new Date(...).getTime(), imune ao formato de serialização do PostgREST', () => {
    const idx = src.indexOf('const claimedRows');
    expect(idx, 'Não encontrei a atribuição de claimedRows.').toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 400);
    expect(block).toMatch(/new Date\(now\)\.getTime\(\)|nowMs/);
    expect(block).toMatch(/new Date\([^)]*\)\.getTime\(\)\s*===\s*nowMs/);
  });

  it('a liberação de claim parcial continua condicionada a claimedIds.length > 0 (comportamento preservado)', () => {
    expect(src).toMatch(/if\s*\(\s*claimedIds\.length\s*>\s*0\s*\)/);
  });
});

describe('Regressão R-065 — prova do descompasso de formato entre PostgREST e toISOString()', () => {
  it('um mesmo instante serializado pelas duas fontes nunca é igual por string, mas é igual por valor numérico', () => {
    // Formato real observado via curl direto na REST API do Supabase.
    const postgrestFormat = '2026-08-15T21:06:08.83+00:00';
    // Formato que new Date().toISOString() sempre produz pro mesmo instante.
    const isoStringFormat = '2026-08-15T21:06:08.830Z';

    expect(postgrestFormat).not.toBe(isoStringFormat);
    expect(new Date(postgrestFormat).getTime()).toBe(new Date(isoStringFormat).getTime());
  });
});
