/**
 * Regressão R-060 — Botão "Desfazer" mesclagem ficava bloqueado antes dos
 * eventos absorvidos "vencerem", porque o log de auditoria já tinha sumido.
 *
 * Bug original (agosto/2026):
 *   `cleanup_old_logs()` apagava TODO `application_logs` com mais de 7 dias
 *   (cron `cleanup-old-logs-daily`, 3h da manhã), incluindo os logs
 *   `action: 'merge_events'` que guardam o snapshot usado pelo
 *   UndoMergeDialog para reconstruir o estado pré-merge. Só que
 *   `MergedEventsTab.tsx` consulta esses logs numa janela de 90 dias — bem
 *   maior que os 7 dias de retenção real. Resultado: qualquer mesclagem com
 *   mais de 7 dias perdia o snapshot e o botão "Desfazer" ficava desabilitado
 *   ("Rollback só é possível via SQL manual"), mesmo com o evento principal
 *   ainda no futuro. Aconteceu de verdade com a mesclagem do evento
 *   "Parador apres. Cat Dealers e+++" (feita em 19/07/2026, log já limpo em
 *   11/08/2026 — só 23 dias depois).
 *
 * Correção:
 *   Migration supabase/migrations/20260811222558_extend_merge_log_retention_for_undo.sql
 *   recria `cleanup_old_logs()` para reter logs com
 *   `context->>'action' IN ('merge_events', 'undo_merge')` por 90 dias,
 *   igualando a janela que MergedEventsTab consulta. Os demais logs
 *   continuam com 7 dias.
 *
 * Este teste é estático (sem rede): garante que a definição mais recente de
 * `cleanup_old_logs()` nas migrations continua isentando merge_events/
 * undo_merge da limpeza de 7 dias, e que a janela usada por MergedEventsTab
 * continua compatível.
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
      'A definição mais recente de cleanup_old_logs() não exclui mais merge_events/undo_merge ' +
        "da limpeza de 7 dias. Isso REINTRODUZ a regressão R-060 (botão 'Desfazer' mesclagem " +
        'fica bloqueado antes do previsto). Veja docs/TESTING.md → Regressões cobertas.'
    ).toMatch(/'merge_events',\s*'undo_merge'/);

    // A retenção estendida precisa cobrir pelo menos a mesma janela que
    // MergedEventsTab consulta (90 dias) — senão o descompasso volta.
    expect(def).toMatch(/INTERVAL\s+'90 days'/);
  });

  it('MergedEventsTab continua consultando a mesma janela de 90 dias assumida pelo cleanup', () => {
    const c = read('src/components/admin/MergedEventsTab.tsx');
    expect(c).toMatch(/90\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });
});
