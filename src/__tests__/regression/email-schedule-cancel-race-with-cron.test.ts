/**
 * Regressão — "Cancelar agendamento" podia ser sobrescrito silenciosamente
 * pelo cron que já tinha começado a processar o envio.
 *
 * Bug original (auditoria de agosto/2026):
 *   `cancelSchedule` (ScheduleSendPanel.tsx) fazia um UPDATE incondicional
 *   pra `status:'draft'`, sem checar `scheduled_send_claimed_at`. Se o cron
 *   (`send-scheduled-email-campaigns`) já tivesse reivindicado a linha
 *   (`scheduled_send_claimed_at` setado) e estivesse no meio da chamada à
 *   E-goi, o cancelamento mostrava toast de sucesso — mas quando o cron
 *   terminava, sobrescrevia o status de volta pra 'sent'. O admin achava
 *   que tinha cancelado, mas o e-mail saía mesmo assim, sem qualquer aviso.
 *
 * Correção:
 *   O UPDATE de cancelamento agora só afeta a linha se
 *   `scheduled_send_claimed_at IS NULL` (o cron ainda não pegou o claim). Se
 *   nenhuma linha for afetada (`.maybeSingle()` retorna null), a UI avisa
 *   explicitamente que o envio já está em processamento e não pode mais ser
 *   cancelado, em vez de fingir sucesso.
 *
 * Este teste é estático (sem render): lê o código-fonte e garante que o
 * gate de `scheduled_send_claimed_at` e o aviso de "não deu tempo"
 * continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — cancelamento de agendamento respeita o claim do cron', () => {
  it('cancelSchedule condiciona o UPDATE em scheduled_send_claimed_at IS NULL', () => {
    const src = read('src/components/admin/emailConfig/ScheduleSendPanel.tsx');
    const fnBlock = src.slice(
      src.indexOf('async function cancelSchedule'),
      src.indexOf('} catch (e: unknown) {')
    );
    expect(
      fnBlock,
      'cancelSchedule voltou a fazer UPDATE incondicional — isso REINTRODUZ a corrida em que o ' +
        'cron sobrescreve silenciosamente um cancelamento que já tinha "funcionado" na UI.'
    ).toMatch(/\.is\('scheduled_send_claimed_at',\s*null\)/);
  });

  it('cancelSchedule avisa quando o UPDATE não afeta nenhuma linha (claim já em andamento)', () => {
    const src = read('src/components/admin/emailConfig/ScheduleSendPanel.tsx');
    const fnBlock = src.slice(
      src.indexOf('async function cancelSchedule'),
      src.indexOf('} catch (e: unknown) {')
    );
    expect(fnBlock).toMatch(/if \(!data\)/);
    expect(fnBlock).toMatch(/não pode mais ser cancelado/);
  });
});
