/**
 * Regressão — "Marcar como enviado manualmente" escondia um agendamento
 * pendente que nunca chegava a disparar de verdade.
 *
 * Bug original (auditoria de agosto/2026):
 *   `summaryStatusOf` fundia `status==='scheduled'` no mesmo bucket visual
 *   de `status==='draft'` — um evento agendado aparecia como "Rascunho na
 *   E-goi" na tabela do Histórico, sem qualquer sinal de que já existia um
 *   envio programado. O botão "Marcar como enviado manualmente" ficava
 *   disponível (porque `isSentLike` só considera 'sent'/'manual') e não
 *   avisava sobre o agendamento — clicar nele sobrescrevia o status pra
 *   'sent'/'manual' sem cancelar de verdade o agendamento na E-goi: a
 *   campanha ficava de rascunho esquecida lá, nunca era disparada, mas o
 *   painel mostrava "Enviado manualmente". Pior: `undoManual` sempre
 *   restaurava pra 'draft', então nem desfazendo o agendamento voltava.
 *
 * Correção:
 *   'scheduled' virou um SummaryStatus próprio com badge "Agendado"
 *   (distinta de "Rascunho na E-goi"); o diálogo de confirmação de
 *   "Marcar como enviado" avisa explicitamente que isso cancela o
 *   agendamento quando o status é 'scheduled'; e `undoManual` restaura pro
 *   status real anterior ('scheduled' quando `scheduled_at` ainda está
 *   preenchido na linha, que markManual nunca limpa).
 *
 * Este teste é estático (sem render): lê o código-fonte e garante que os
 * três pontos da correção continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { summaryStatusOf, type SummaryStatus } from '@/components/admin/emailConfig/emailEventsTab/helpers';
import type { Campaign } from '@/components/admin/emailConfig/types';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

const baseCampaign: Campaign = {
  id: 'c1',
  event_id: 'e1',
  egoi_campaign_id: 'egoi-1',
  status: 'scheduled',
  mode: 'scheduled',
  error_message: null,
  sent_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
};

describe('Regressão — Histórico distingue "Agendado" de "Rascunho" e não perde agendamento ao desfazer', () => {
  it('summaryStatusOf não funde mais scheduled com draft', () => {
    const result: SummaryStatus = summaryStatusOf(baseCampaign);
    expect(result).toBe('scheduled');
    expect(result).not.toBe('draft');
  });

  it('summaryStatusOf continua distinguindo draft normal', () => {
    const result = summaryStatusOf({ ...baseCampaign, status: 'draft', mode: 'draft' });
    expect(result).toBe('draft');
  });

  it('EventRow.tsx avisa explicitamente sobre cancelar o agendamento quando s === "scheduled"', () => {
    const src = read('src/components/admin/emailConfig/emailEventsTab/EventRow.tsx');
    expect(
      src,
      'O diálogo de "Marcar como enviado manualmente" não avisa mais sobre cancelar um ' +
        'agendamento pendente — isso REINTRODUZ a armadilha de sobrescrever um agendamento sem aviso.'
    ).toMatch(/cancela esse agendamento/);
  });

  it('useEventActions.ts: undoManual restaura para scheduled quando scheduled_at ainda existe', () => {
    const src = read('src/components/admin/emailConfig/emailEventsTab/useEventActions.ts');
    expect(
      src,
      'undoManual voltou a restaurar sempre para "draft" — isso REINTRODUZ a perda permanente ' +
        'do agendamento mesmo desfazendo a marcação manual.'
    ).toMatch(/wasScheduled/);
    expect(src).toMatch(/mode:\s*wasScheduled\s*\?\s*'scheduled'\s*:\s*'draft'/);
  });
});
