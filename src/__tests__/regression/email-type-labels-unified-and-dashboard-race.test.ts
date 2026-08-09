/**
 * Regressão — Limpeza de duplicação e corrida no Dashboard (grupo de 2,
 * Fase 10 da auditoria de agosto/2026).
 *
 * 1) Rótulos de tipo de e-mail (ex. "Digest semanal") eram mantidos em pelo
 *    menos dois mapas literais separados (EmailDashboard.tsx e
 *    typeFilter.ts), que já tinham divergido entre si ("Digest" vs "Digest
 *    semanal" pro mesmo conceito). Unificados em
 *    src/lib/emailTemplates/typeLabels.ts.
 *
 * 2) EmailDashboard.load() não tinha sequenciamento de requisições
 *    concorrentes — trocar o período rápido (7→30→90 dias) podia mostrar
 *    KPIs de um range já abandonado.
 *
 * Este teste é estático (sem render): lê o código-fonte e garante que as
 * duas correções continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EMAIL_TYPE_LABELS } from '@/lib/emailTemplates/typeLabels';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — rótulos de tipo de e-mail vêm de uma única fonte', () => {
  it('EMAIL_TYPE_LABELS cobre os tipos usados tanto no Dashboard quanto no Editor', () => {
    const keys = [
      'event_new',
      'ticket_batch',
      'ticket_batch_multi',
      'weekend_agenda',
      'weekly_digest',
      'blog_digest',
      'event_reminder',
      'courtesy',
      'custom',
      'standard',
      'ab_test_a',
      'ab_test_b',
    ];
    for (const k of keys) {
      expect(EMAIL_TYPE_LABELS[k], `falta rótulo pra "${k}"`).toBeTruthy();
    }
  });

  it('EmailDashboard.tsx e typeFilter.ts importam do mesmo módulo (não voltaram a duplicar)', () => {
    const dashboardSrc = read('src/components/admin/EmailDashboard.tsx');
    const typeFilterSrc = read('src/components/admin/emailTemplateEditor/typeFilter.ts');
    expect(dashboardSrc).toMatch(/from '@\/lib\/emailTemplates\/typeLabels'/);
    expect(typeFilterSrc).toMatch(/from '@\/lib\/emailTemplates\/typeLabels'/);
  });

  it('o rótulo de weekly_digest não diverge mais entre Dashboard e Editor ("Digest" vs "Digest semanal")', () => {
    expect(EMAIL_TYPE_LABELS.weekly_digest).toBe('Digest semanal');
  });
});

describe('Regressão — EmailDashboard.load() sequencia requisições concorrentes', () => {
  it('load() ignora respostas que não são da requisição mais recente', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(
      src,
      'EmailDashboard.load() perdeu o sequenciamento por requestId — isso REINTRODUZ a corrida ' +
        'em que trocar o período rápido pode mostrar KPIs de um range já abandonado.'
    ).toMatch(/loadRequestIdRef/);
    expect(src).toMatch(/requestId !== loadRequestIdRef\.current/);
  });
});
