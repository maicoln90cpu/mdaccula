/**
 * R-062 — causa raiz definitiva da classe "dispatch travado sem campanha e
 * sem erro" que sobreviveu a R-055/R-057/R-058/R-059: quando a Edge Function
 * morre entre o claim do evento e a chamada à E-goi SEM lançar nenhuma
 * exceção JS (timeout de plataforma, abort de cliente), nenhum catch/finally
 * roda — nenhuma das proteções anteriores (que dependem de captura de erro)
 * é alcançada. A correção grava a INTENÇÃO de disparo (status 'in_progress')
 * em event_email_campaigns ANTES de qualquer chamada de rede à E-goi, então
 * "claim setado sem nenhuma linha de histórico" deixa de ser um estado
 * alcançável. Confirmado em produção em 15/08/2026: Music ON, One Life,
 * Helvétia (nunca enviados) e RoofTech/Krush/Solomun/Industria (enviados
 * antes, mas com um claim fantasma posterior sem campanha nenhuma atrás).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-062 — linha "in_progress" gravada antes de qualquer chamada à E-goi', () => {
  it('create-event-email-campaign: beginInProgressHistoryRow acontece antes de egoiRequest', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const beginIdx = src.indexOf('beginInProgressHistoryRow(');
    const cacheIdx = src.indexOf('cacheStaticMapImagesInHtml(html)');
    const egoiCallIdx = src.indexOf("egoiRequest('/campaigns/email'");

    expect(beginIdx, 'Não encontrei a chamada a beginInProgressHistoryRow.').toBeGreaterThan(-1);
    expect(cacheIdx, 'Não encontrei a chamada a cacheStaticMapImagesInHtml.').toBeGreaterThan(-1);
    expect(egoiCallIdx, 'Não encontrei a chamada a egoiRequest("/campaigns/email").').toBeGreaterThan(-1);

    expect(
      beginIdx,
      'A linha "in_progress" precisa ser gravada ANTES do cache de mapas (rede) — senão a function pode ' +
        'morrer ali sem deixar nenhum rastro, reproduzindo o R-055/R-057/R-058/R-059.'
    ).toBeLessThan(cacheIdx);
    expect(
      beginIdx,
      'A linha "in_progress" precisa ser gravada ANTES da chamada à E-goi — é essa ordem que garante que ' +
        '"claim sem nenhuma linha de histórico" nunca mais aconteça.'
    ).toBeLessThan(egoiCallIdx);
  });

  it('create-event-email-campaign: falha ao gravar a linha "in_progress" libera o claim e não chega a chamar a E-goi', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const beginIdx = src.indexOf('beginInProgressHistoryRow(');
    const egoiCallIdx = src.indexOf("egoiRequest('/campaigns/email'");
    const block = src.slice(beginIdx, egoiCallIdx);

    expect(
      block,
      'Se beginInProgressHistoryRow falhar, o claim precisa ser liberado antes de responder — ainda não ' +
        'houve contato nenhum com a E-goi, é seguro.'
    ).toMatch(/if\s*\(beginError \|\| !beganId\)[\s\S]*?email_campaign_dispatched_at:\s*null/);
    expect(block).toMatch(/historyRowId\s*=\s*beganId/);
  });

  it('create-multi-event-email-campaign: beginInProgressHistoryRows acontece antes de egoiRequest', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    const beginIdx = src.indexOf('beginInProgressHistoryRows(');
    const cacheIdx = src.indexOf('safeCacheStaticMapImagesInHtml(html');
    const egoiCallIdx = src.indexOf("egoiRequest('/campaigns/email'");

    expect(beginIdx, 'Não encontrei a chamada a beginInProgressHistoryRows.').toBeGreaterThan(-1);
    expect(cacheIdx, 'Não encontrei a chamada a safeCacheStaticMapImagesInHtml.').toBeGreaterThan(-1);
    expect(egoiCallIdx, 'Não encontrei a chamada a egoiRequest("/campaigns/email").').toBeGreaterThan(-1);

    expect(beginIdx).toBeLessThan(cacheIdx);
    expect(beginIdx).toBeLessThan(egoiCallIdx);
  });

  it('create-multi-event-email-campaign: grava uma linha "in_progress" por evento (mesmo padrão de N linhas do histórico final)', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    const beginIdx = src.indexOf('beginInProgressHistoryRows(');
    const block = src.slice(beginIdx, beginIdx + 900);
    expect(block).toMatch(/eventIds\.map\(/);
    expect(block).toMatch(/historyRowIds\s*=\s*beganIds/);
  });

  it('as duas functions importam o helper compartilhado (não duplicam a lógica de histórico "in_progress")', () => {
    const single = read('supabase/functions/create-event-email-campaign/index.ts');
    const multi = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    expect(single).toMatch(/from ['"]\.\.\/_shared\/emailDispatchHistory\.ts['"]/);
    expect(multi).toMatch(/from ['"]\.\.\/_shared\/emailDispatchHistory\.ts['"]/);
  });
});
