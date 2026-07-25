/**
 * Regressão R-029 — botão "Enviar agora" da aba Automações (Digest semanal /
 * Agenda FDS / Blog news) ficava com aparência travada (disabled) sempre que
 * a página era recarregada, mesmo já existindo um rascunho válido criado na
 * E-goi minutos antes.
 *
 * Causa: digestLastResult/weekendLastResult/blogLastResult em
 * useEmailAutomation.ts eram só estado React em memória — nunca persistidos
 * — então qualquer reload zerava o valor e o botão voltava a exigir "Gerar
 * rascunho agora" de novo, mesmo com uma campanha já pronta na E-goi.
 *
 * Correção: persistir o último rascunho por job em site_settings
 * (`${job}_last_result`) e restaurá-lo em `loadAll()` (EmailConfig.tsx).
 * Para não abrir uma janela de reenvio duplicado, o valor persistido/local é
 * limpo assim que o envio real é concluído com sucesso.
 *
 * Proteção: guarda estática — falha se a persistência ou a limpeza pós-envio
 * regredirem.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-029 — "Enviar agora" sobrevive a reload sem permitir reenvio duplicado', () => {
  it('useEmailAutomation persiste o último rascunho de cada job em site_settings', () => {
    const content = read('src/components/admin/emailConfig/useEmailAutomation.ts');

    expect(content).toContain('async function persistLastResult(');
    expect(content).toContain("value: res ? JSON.stringify(res) : ''");

    for (const [setter, job] of [
      ['setDigestLastResult(res)', "'weekly_digest'"],
      ['setWeekendLastResult(res)', "'weekend_agenda'"],
      ['setBlogLastResult(res)', "'blog_digest'"],
    ]) {
      const idx = content.indexOf(setter);
      expect(idx, `${setter} não encontrado`).toBeGreaterThan(-1);
      const after = content.slice(idx, idx + 200);
      expect(after, `${setter} deveria persistir via persistLastResult(${job}, res)`).toContain(
        `persistLastResult(${job}, res)`
      );
    }
  });

  it('sendAutomationNow limpa estado local e persistido ao concluir o envio (evita duplo envio)', () => {
    const content = read('src/components/admin/emailConfig/useEmailAutomation.ts');

    const sendFnMatch = content.match(
      /const sendAutomationNow = async \([\s\S]*?\n  \};/
    );
    expect(sendFnMatch, 'função sendAutomationNow não encontrada').toBeTruthy();
    const fnBody = sendFnMatch![0];

    // Job agora é parâmetro explícito — sem ele não dá pra saber qual chave
    // limpar, e o botão ficaria vulnerável a reenviar a mesma campanha.
    expect(fnBody).toContain('job: AutomationJob');
    expect(fnBody).toContain('lastResultSetters[job](null)');
    expect(fnBody).toContain('persistLastResult(job, null)');
  });

  it('EmailConfig.tsx busca e restaura o último rascunho persistido de cada job', () => {
    const content = read('src/pages/admin/EmailConfig.tsx');

    expect(content).toContain("'weekly_digest_last_result'");
    expect(content).toContain("'weekend_agenda_last_result'");
    expect(content).toContain("'blog_digest_last_result'");

    expect(content).toContain('setDigestLastResult(parseLastResult(settingsMap.weekly_digest_last_result))');
    expect(content).toContain(
      'setWeekendLastResult(parseLastResult(settingsMap.weekend_agenda_last_result))'
    );
    expect(content).toContain('setBlogLastResult(parseLastResult(settingsMap.blog_digest_last_result))');
  });
});
