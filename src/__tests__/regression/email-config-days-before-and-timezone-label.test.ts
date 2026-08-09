/**
 * Regressão — Configuração (grupo de 2, Fase 8 da auditoria de agosto/2026).
 *
 * NOTA: um terceiro item planejado originalmente para este grupo ("resetar
 * segmento ao trocar de evento/template") foi descartado ao implementar —
 * ele reverteria a correção deliberada da Regressão R-032
 * (email-manual-send-segment-not-reset.test.ts), que trocou exatamente
 * esse reset por manter o segmento e só exibir o valor resolvido antes do
 * envio. Resetar de novo reintroduziria R-032.
 *
 * 1) "Dias antes do evento" (ConfigTab, modo agendado) só era validado via
 *    atributos HTML min/max do input — que não impedem colar/digitar um
 *    valor fora do intervalo (ex.: -5 ou 999). O valor ia pro banco sem
 *    checagem nenhuma. Agora o valor é clampado em [1,30] no onChange, e a
 *    coluna `egoi_config.scheduled_days_before` ganhou um CHECK constraint
 *    como segunda camada de defesa (migration
 *    20260809100000_egoi_config_scheduled_days_before_check.sql).
 *
 * 2) O campo "Agendar para" (Envio manual, ScheduleSendPanel) não indicava
 *    qual fuso horário estava sendo usado — o valor `datetime-local` é
 *    sempre interpretado no fuso do navegador do admin, então um
 *    computador fora do fuso de Brasília agendaria no horário errado sem
 *    aviso nenhum.
 *
 * Este teste é estático (sem render): lê o código-fonte/migration e garante
 * que as duas correções continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — "Dias antes do evento" validado no cliente E no banco', () => {
  it('ConfigTab.tsx clampa o valor digitado/colado em [1,30]', () => {
    const src = read('src/components/admin/emailConfig/ConfigTab.tsx');
    expect(
      src,
      'ConfigTab.tsx voltou a aceitar qualquer valor de scheduled_days_before sem clampar — ' +
        'isso REINTRODUZ a possibilidade de salvar um valor absurdo (ex.: 999 dias).'
    ).toMatch(/Math\.min\(30, Math\.max\(1, Math\.round\(raw\)\)\)/);
  });

  it('migration adiciona CHECK constraint em egoi_config.scheduled_days_before', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260809100000_egoi_config_scheduled_days_before_check.sql'
    );
    expect(fs.existsSync(migrationPath), 'Migration do CHECK constraint não encontrada').toBe(true);
    const sql = read(
      'supabase/migrations/20260809100000_egoi_config_scheduled_days_before_check.sql'
    );
    expect(sql).toMatch(/CHECK \(scheduled_days_before IS NULL OR \(scheduled_days_before BETWEEN 1 AND 30\)\)/);
  });
});

describe('Regressão — campo de agendamento manual indica o fuso horário usado', () => {
  it('ScheduleSendPanel.tsx avisa que o horário é o do navegador do admin', () => {
    const src = read('src/components/admin/emailConfig/ScheduleSendPanel.tsx');
    expect(src).toMatch(/horário local do seu navegador/);
  });
});
