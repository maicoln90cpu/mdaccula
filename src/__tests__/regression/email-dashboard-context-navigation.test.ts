/**
 * Melhoria — Dashboard: contexto e navegação (Fase 11 da auditoria de
 * agosto/2026).
 *
 * 1) KPIs agora mostram variação % vs. o período anterior de mesma duração.
 * 2) "Taxa geral" de abertura/clique passou a ser ponderada por volume
 *    (soma de aberturas ÷ soma de entregues), não mais a média aritmética
 *    das taxas por campanha — uma campanha de 50 contatos não pesa mais
 *    igual a uma de 5.000.
 * 3) A tabela de detalhe agora linka cada evento pra aba Histórico e
 *    controle, já filtrada por esse título (EmailConfig.tsx →
 *    EmailEventsTab.focusRequest).
 *
 * Este teste é estático (sem render): lê o código-fonte e garante que as
 * três peças continuam presentes e conectadas.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — Dashboard mostra variação vs. período anterior', () => {
  it('EmailDashboard.tsx calcula e busca o período anterior', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/previousRange/);
    expect(src).toMatch(/loadPrevious/);
    expect(src).toMatch(/function variancePct/);
  });

  it('os 4 KPIs principais recebem a prop delta calculada por variancePct', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    const matches = src.match(/delta=\{variancePct\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Melhoria — taxa geral ponderada por volume', () => {
  it('aggregate() calcula a taxa como soma÷soma, não média das taxas por campanha', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(
      src,
      'A taxa voltou a ser calculada por média simples (openRateSum/withStats) — isso ' +
        'REINTRODUZ o viés de dar o mesmo peso a campanhas de tamanhos muito diferentes.'
    ).not.toMatch(/openRateSum \/ withStats/);
    expect(src).toMatch(/rateBase > 0 \? opens \/ rateBase : null/);
  });
});

describe('Melhoria — tabela de detalhe linka pro Histórico', () => {
  it('EmailDashboard.tsx expõe onViewInHistory e usa no título do evento', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/onViewInHistory/);
  });

  it('EmailConfig.tsx conecta EmailDashboard.onViewInHistory ao focusRequest do EmailEventsTab', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    expect(src).toMatch(/handleViewInHistory/);
    expect(src).toMatch(/onViewInHistory=\{handleViewInHistory\}/);
    expect(src).toMatch(/focusRequest=\{historyFocus\}/);
  });

  it('EmailEventsTab.tsx aplica o focusRequest (busca + período "Todos")', () => {
    const src = read('src/components/admin/emailConfig/EmailEventsTab.tsx');
    expect(src).toMatch(/focusRequest/);
    expect(src).toMatch(/setSearch\(focusRequest\.eventTitle\)/);
    expect(src).toMatch(/setPeriod\('all'\)/);
  });
});
