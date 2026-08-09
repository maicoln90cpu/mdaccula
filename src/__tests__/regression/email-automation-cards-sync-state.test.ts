/**
 * Regressão — sincronização de estado nas abas Template (marca) e
 * Automações (grupo de 3 melhorias da auditoria de agosto/2026).
 *
 * 1) Preview da aba "Template (marca)" não avisava que mostra a última
 *    versão SALVA do template, não as edições em andamento na aba
 *    "Editor + Preview" — o admin podia achar que uma alteração "não
 *    pegou" quando na verdade só não tinha sido salva ainda.
 *
 * 2) `loadDigestPreview` (useEmailPreview.ts) não tinha sequenciamento de
 *    requisições concorrentes — trocar de template rápido podia deixar uma
 *    resposta antiga sobrescrever a mais nova.
 *
 * 3) Os cards de automação (Digest semanal/Agenda FDS/Blog news/Lembrete de
 *    evento) mostravam "Próxima execução" lendo só o estado local do
 *    formulário, sem indicar quando ele diverge do que está realmente
 *    persistido no banco.
 *
 * Este teste é estático (sem render): lê o código-fonte e garante que as
 * três correções continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — preview de Template (marca) avisa que mostra a versão salva', () => {
  it('TemplateBrandTab.tsx indica explicitamente que o preview é da última versão salva', () => {
    const src = read('src/components/admin/emailConfig/TemplateBrandTab.tsx');
    expect(src).toMatch(/última versão.*salva/i);
  });
});

describe('Regressão — loadDigestPreview sequencia respostas concorrentes', () => {
  it('useEmailPreview.ts ignora respostas que não são da requisição mais recente', () => {
    const src = read('src/components/admin/emailConfig/useEmailPreview.ts');
    expect(
      src,
      'loadDigestPreview perdeu o sequenciamento por requestId — isso REINTRODUZ a corrida em ' +
        'que uma resposta antiga (de um template já abandonado) sobrescreve o preview atual.'
    ).toMatch(/digestPreviewRequestIdRef/);
    expect(src).toMatch(/requestId !== digestPreviewRequestIdRef\.current/);
  });
});

describe('Regressão — cards de automação avisam sobre alterações não salvas', () => {
  const files = [
    'src/components/admin/emailConfig/automations/AutomationCard.tsx',
    'src/components/admin/emailConfig/automations/EventReminderAutomationCard.tsx',
  ];
  for (const file of files) {
    it(`${file}: recebe isDirty e mostra o aviso perto de "Próxima execução"`, () => {
      const src = read(file);
      expect(src).toMatch(/isDirty/);
      expect(src).toMatch(/Alterações não salvas/);
    });
  }

  it('useEmailAutomation.ts expõe hydrate*/isDirty distintos dos setters de edição ao vivo', () => {
    const src = read('src/components/admin/emailConfig/useEmailAutomation.ts');
    expect(src).toMatch(/hydrateWeeklyCfg: weeklyState\.hydrate/);
    expect(src).toMatch(/isWeeklyDirty: weeklyState\.isDirty/);
  });

  it('useEventReminderAutomation.ts expõe hydrateCfg/isDirty', () => {
    const src = read('src/components/admin/emailConfig/useEventReminderAutomation.ts');
    expect(src).toMatch(/hydrateCfg/);
    expect(src).toMatch(/isDirty/);
  });
});
