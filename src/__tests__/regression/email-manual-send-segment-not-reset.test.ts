/**
 * Regressão R-032 — Segmento escolhido no Envio Manual resetava
 * silenciosamente pro padrão global.
 *
 * Bug original (agosto/2026):
 *   `ManualSendTab.tsx` chamava `setBatchSegmentId(undefined)` nos
 *   `onValueChange` dos Selects de Evento e de Template — trocar
 *   evento/template depois de escolher um segmento específico resetava a
 *   escolha de volta pro "Padrão da configuração global" sem nenhum aviso
 *   visual. O admin confirmava o envio achando que o segmento escolhido
 *   seria usado, mas o disparo real ia pro segmento/lista padrão.
 *
 * Correção:
 *   Os dois resets foram removidos (o segmento é uma escolha de audiência
 *   independente do evento/template). Além disso, o segmento resolvido
 *   passou a ser exibido na "Revisão final" e no modal de confirmação
 *   (`SendNowButton`), pra qualquer reset futuro ficar visível antes do
 *   envio em vez de silencioso.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que os
 * Selects de Evento/Template não voltam a resetar `batchSegmentId`, e que
 * o segmento resolvido é exibido antes do envio.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-032 — segmento do Envio Manual não reseta mais ao trocar evento/template', () => {
  it('ManualSendTab.tsx não reseta mais batchSegmentId no Select de Evento', () => {
    const src = read('src/components/admin/emailConfig/ManualSendTab.tsx');
    const eventSelectBlock = src.slice(
      src.indexOf('value={batchEventId}'),
      src.indexOf('<SelectTrigger>', src.indexOf('value={batchEventId}'))
    );
    expect(
      eventSelectBlock,
      'O Select de Evento em ManualSendTab.tsx voltou a resetar batchSegmentId — isso ' +
        'REINTRODUZ a regressão R-032 (segmento escolhido é descartado silenciosamente ao ' +
        'trocar o evento).'
    ).not.toMatch(/setBatchSegmentId\(undefined\)/);
  });

  it('ManualSendTab.tsx não reseta mais batchSegmentId no Select de Template', () => {
    const src = read('src/components/admin/emailConfig/ManualSendTab.tsx');
    const templateSelectBlock = src.slice(
      src.indexOf('value={batchTemplateId}'),
      src.indexOf('<SelectTrigger>', src.indexOf('value={batchTemplateId}'))
    );
    expect(
      templateSelectBlock,
      'O Select de Template em ManualSendTab.tsx voltou a resetar batchSegmentId — isso ' +
        'REINTRODUZ a regressão R-032 (segmento escolhido é descartado silenciosamente ao ' +
        'trocar o template).'
    ).not.toMatch(/setBatchSegmentId\(undefined\)/);
  });

  it('o segmento resolvido é exibido na revisão final e passado pro SendNowButton', () => {
    const src = read('src/components/admin/emailConfig/ManualSendTab.tsx');
    expect(src).toMatch(/resolvedSegmentLabel/);
    expect(src).toMatch(/segmentLabel=\{resolvedSegmentLabel\}/);
  });

  it('SendNowButton exibe o segmento recebido na confirmação de envio', () => {
    const src = read('src/components/admin/emailConfig/SendNowButton.tsx');
    expect(src).toMatch(/segmentLabel/);
  });
});
