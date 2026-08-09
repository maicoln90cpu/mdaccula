/**
 * Melhoria — Automações: histórico e cobertura de teste (Fase 17 da
 * auditoria de agosto/2026).
 *
 * 1) "Lembrete de evento" era a única das 4 automações sem "Enviar teste
 *    agora" (a automação pode gerar N campanhas por execução, uma por
 *    evento elegível — diferente do fluxo de 1 campanha das outras 3).
 *    Ganhou suporte a `dry_run` na edge function (renderiza o primeiro
 *    evento-alvo elegível como amostra, sem criar nada na E-goi nem gravar
 *    em event_email_campaigns) e reaproveita o sendAutomationTest genérico
 *    já usado pelas outras 3.
 *
 * 2) Histórico de execuções por automação (não só o último resultado) —
 *    guardado em site_settings como JSON (automationRunHistory.ts), capado
 *    em 10 entradas, exibido num painel colapsável (RunHistoryList) nos 4
 *    cards.
 *
 * Teste estático (sem render/rede): garante que as peças continuam
 * presentes e conectadas.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — "Enviar teste agora" no card de Lembrete de evento', () => {
  it('send-event-reminder-campaigns aceita dry_run e retorna html/subject sem criar campanha', () => {
    const src = read('supabase/functions/send-event-reminder-campaigns/index.ts');
    expect(src).toMatch(/const dryRun = body\?\.dry_run === true/);
    expect(src).toMatch(/if \(dryRun\) \{/);
    // A branch de dry_run precisa retornar ANTES do loop que cria campanhas de verdade.
    const dryRunIdx = src.indexOf('if (dryRun) {');
    const loopIdx = src.indexOf('for (const eventRow of pending)');
    expect(dryRunIdx).toBeGreaterThan(0);
    expect(loopIdx).toBeGreaterThan(dryRunIdx);
  });

  it('EmailConfig.tsx conecta o botão de teste ao sendAutomationTest genérico', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    expect(src).toMatch(/onTestEventReminder=\{\(\) =>\s*\n\s*sendAutomationTest\(\s*\n\s*'send-event-reminder-campaigns'/);
  });

  it('EventReminderAutomationCard.tsx tem o botão "Enviar teste agora"', () => {
    const src = read('src/components/admin/emailConfig/automations/EventReminderAutomationCard.tsx');
    expect(src).toMatch(/Enviar teste agora/);
    expect(src).toMatch(/onTest/);
  });
});

describe('Melhoria — histórico de execuções por automação', () => {
  it('automationRunHistory.ts cappa em 10 entradas e persiste em site_settings', () => {
    const src = read('src/components/admin/emailConfig/automationRunHistory.ts');
    expect(src).toMatch(/MAX_HISTORY = 10/);
    expect(src).toMatch(/runHistoryKey/);
  });

  it('as 4 automações (weekly/weekend/blog/event_reminder) registram histórico em sucesso, skip e falha', () => {
    const emailAutomation = read('src/components/admin/emailConfig/useEmailAutomation.ts');
    expect((emailAutomation.match(/appendRunHistory\(/g) ?? []).length).toBeGreaterThanOrEqual(9); // 3 jobs x 3 branches
    const eventReminder = read('src/components/admin/emailConfig/useEventReminderAutomation.ts');
    expect((eventReminder.match(/appendRunHistory\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('useEmailConfigState.ts hidrata o histórico salvo a partir de site_settings em loadAll', () => {
    const src = read('src/components/admin/emailConfig/useEmailConfigState.ts');
    expect(src).toMatch(/parseRunHistory\(settingsMap\.weekly_digest_run_history\)/);
    expect(src).toMatch(/parseRunHistory\(settingsMap\.event_reminder_run_history\)/);
  });

  it('RunHistoryList.tsx é usado nos 4 cards de automação', () => {
    const automationCard = read('src/components/admin/emailConfig/automations/AutomationCard.tsx');
    const eventReminderCard = read(
      'src/components/admin/emailConfig/automations/EventReminderAutomationCard.tsx'
    );
    expect(automationCard).toMatch(/<RunHistoryList history={runHistory} \/>/);
    expect(eventReminderCard).toMatch(/<RunHistoryList history={runHistory} \/>/);
  });
});
