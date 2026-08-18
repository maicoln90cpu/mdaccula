/**
 * Regressão R-060 — Botão "Desfazer" mesclagem ficava bloqueado antes dos
 * eventos absorvidos "vencerem", porque o log de auditoria já tinha sumido.
 *
 * Bug original (agosto/2026):
 *   `cleanup_old_logs()` apagava TODO `application_logs` com mais de 7 dias
 *   (cron `cleanup-old-logs-daily`, 3h da manhã), incluindo os logs
 *   `action: 'merge_events'` que guardam o snapshot usado pelo
 *   UndoMergeDialog para reconstruir o estado pré-merge. Só que
 *   `MergedEventsTab.tsx` consultava esses logs numa janela de 90 dias — bem
 *   maior que os 7 dias de retenção real. Resultado: qualquer mesclagem com
 *   mais de 7 dias perdia o snapshot e o botão "Desfazer" ficava desabilitado
 *   ("Rollback só é possível via SQL manual"), mesmo com o evento principal
 *   ainda no futuro.
 *
 * Correção original:
 *   Migration supabase/migrations/20260811222558_extend_merge_log_retention_for_undo.sql
 *   recria `cleanup_old_logs()` para reter logs com
 *   `context->>'action' IN ('merge_events', 'undo_merge')` por 90 dias.
 *   Essa migration continua no banco e continua correta — mantida por
 *   segurança, mesmo não sendo mais usada (ver nota abaixo).
 *
 * Atualização (R-075, 18/08/2026):
 *   A mesclagem foi redesenhada pra nunca depender de `application_logs` —
 *   `MergedEventsTab.tsx` agora lê os grupos direto de `events`
 *   (`is_merge_shell`/`merged_into_id`), sem nenhum log envolvido. Isso torna
 *   a classe de bug do R-060 estruturalmente impossível (não existe mais
 *   nenhuma "janela" pra desalinhar), então o segundo teste abaixo foi
 *   adaptado pra confirmar exatamente isso, em vez de checar um acoplamento
 *   que deixou de existir.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

function latestCleanupOldLogsDefinition(): string | null {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let last: string | null = null;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    if (/CREATE OR REPLACE FUNCTION public\.cleanup_old_logs\s*\(\)/i.test(sql)) {
      last = sql;
    }
  }
  return last;
}

describe('Regressão R-060 — retenção de logs de merge_events/undo_merge', () => {
  it("cleanup_old_logs() mais recente isenta merge_events/undo_merge da janela de 7 dias", () => {
    const def = latestCleanupOldLogsDefinition();
    expect(
      def,
      'Nenhuma migration define cleanup_old_logs(). Veja docs/TESTING.md → Regressões cobertas → R-060.'
    ).toBeTruthy();

    expect(
      def,
      "A definição mais recente de cleanup_old_logs() não exclui mais merge_events/undo_merge " +
        "da limpeza de 7 dias. Isso não quebra mais o desfazer (R-075 removeu essa dependência), " +
        'mas a migration em si deve continuar correta. Veja docs/TESTING.md → Regressões cobertas.'
    ).toMatch(/'merge_events',\s*'undo_merge'/);

    expect(def).toMatch(/INTERVAL\s+'90 days'/);
  });

  it('MergedEventsTab não depende mais de application_logs pra listar mesclagens (R-075)', () => {
    const c = read('src/components/admin/MergedEventsTab.tsx');
    expect(
      c,
      'MergedEventsTab voltou a consultar application_logs — isso reintroduz a classe de bug ' +
        'do R-060 (mesclagens somem da lista quando o log expira). Veja R-075 em docs/TESTING.md.'
    ).not.toMatch(/\.from\(\s*['"]application_logs['"]\s*\)/);
    expect(c).toMatch(/is_merge_shell/);
  });
});
