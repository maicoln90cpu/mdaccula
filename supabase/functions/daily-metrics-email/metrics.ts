// Funções puras (sem I/O) do e-mail diário de métricas — testáveis isoladamente
// via `npm run test:edge` (metrics_test.ts).

export interface DayWindow {
  startUTC: Date;
  endUTC: Date;
}

// BRT (Brasília) é UTC-3 fixo — o Brasil não usa mais horário de verão desde 2019.
const BRT_OFFSET_HOURS = 3;

/**
 * Janela [start, end) em UTC correspondente a um dia inteiro no calendário BRT.
 * daysAgo=1 → ontem (BRT); daysAgo=2 → anteontem; etc.
 * referenceDate é injetável para tornar a função determinística em teste.
 */
export function getBRTDayWindowUTC(daysAgo: number, referenceDate: Date = new Date()): DayWindow {
  // Desloca o relógio -3h para que toISOString() devolva a data de calendário BRT.
  const nowBRT = new Date(referenceDate.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000);
  const todayBRTDateStr = nowBRT.toISOString().slice(0, 10);

  const targetDayLabel = new Date(`${todayBRTDateStr}T00:00:00.000Z`);
  targetDayLabel.setUTCDate(targetDayLabel.getUTCDate() - daysAgo);

  // Meia-noite BRT daquele dia = 03:00 UTC do mesmo dia de calendário.
  const startUTC = new Date(targetDayLabel.getTime() + BRT_OFFSET_HOURS * 60 * 60 * 1000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  return { startUTC, endUTC };
}

/** Variação percentual de `current` em relação a `baseline`. Nunca retorna Infinity/NaN. */
export function computeVariancePct(current: number, baseline: number): number | null {
  if (!baseline || baseline <= 0 || !Number.isFinite(baseline)) return null;
  return ((current - baseline) / baseline) * 100;
}

export interface MetricResult {
  key: string;
  label: string;
  yesterday: number;
  dayBefore: number;
  baselineDailyAvg: number;
  varianceVsDayBeforePct: number | null;
  varianceVsBaselinePct: number | null;
}

function formatVariance(pct: number | null): string {
  if (pct === null) return '<span style="color:#888">sem dado de comparação</span>';
  const arrow = pct >= 0 ? "▲" : "▼";
  const color = pct >= 0 ? "#22c55e" : "#ef4444";
  return `<span style="color:${color}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

export function buildEmailHtml(metrics: MetricResult[], dateLabel: string): string {
  const rows = metrics
    .map(
      (m) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #222;color:#eee;">${m.label}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #222;text-align:right;color:#fff;font-weight:600;">${m.yesterday}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #222;text-align:right;">${formatVariance(m.varianceVsDayBeforePct)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #222;text-align:right;font-size:11px;color:#999;">
            média 7d: ${m.baselineDailyAvg.toFixed(1)}${m.varianceVsBaselinePct !== null ? ` (${formatVariance(m.varianceVsBaselinePct)})` : ""}
          </td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:600px;margin:auto;padding:16px;background:#0a0a0a;">
      <h2 style="color:#a855f7;margin:0 0 4px">📊 Métricas Diárias — MDAccula</h2>
      <p style="color:#999;margin:0 0 16px;font-size:13px">Dados de ${dateLabel}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;color:#999;font-size:11px;text-transform:uppercase;">Métrica</th>
            <th style="text-align:right;padding:8px;color:#999;font-size:11px;text-transform:uppercase;">Ontem</th>
            <th style="text-align:right;padding:8px;color:#999;font-size:11px;text-transform:uppercase;">vs. Anteontem</th>
            <th style="text-align:right;padding:8px;color:#999;font-size:11px;text-transform:uppercase;">Média 7d</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#666;font-size:12px;margin-top:20px">
        Enviado automaticamente todo dia às 08h (Brasília). Dashboard:
        <a href="https://mdaccula.com/admin/links-analytics" style="color:#a855f7">Analytics de Links</a>
      </p>
    </div>`;
}
