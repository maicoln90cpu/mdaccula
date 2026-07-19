// Funções puras (sem I/O) do e-mail diário de métricas — testáveis isoladamente
// via `npm run test:edge` (metrics_test.ts).

const SITE_URL = "https://mdaccula.com";

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

/** Data no formato "dd/mm" ou "dd/mm/yyyy" (BRT), usada nos rótulos de período dos cards. */
export function formatBRTDate(date: Date, withYear = true): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "numeric" as const } : {}),
  });
}

/** "dd/mm – dd/mm" a partir de uma janela [start, end) exclusiva de dias inteiros BRT. */
export function formatBRTDateRange(start: Date, end: Date): string {
  const lastDayIncluded = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${formatBRTDate(start, false)} – ${formatBRTDate(lastDayIncluded, false)}`;
}

/**
 * Janela mês-a-mês (BRT): do dia 1 do mês de `yesterdayStartUTC` até o fim
 * daquele dia (mês atual até ontem, já que hoje ainda não fechou), e a janela
 * equivalente do mês anterior — mesma quantidade de dias corridos, começando
 * também no dia 1. Se o mês anterior tiver menos dias que o atual (ex.: atual
 * em 30/31, anterior é fevereiro), trunca no último dia do mês anterior.
 */
export function getBRTMonthToDateWindows(yesterdayStartUTC: Date): { current: DayWindow; previous: DayWindow } {
  // yesterdayStartUTC = meia-noite BRT daquele dia, já deslocada +3h (ver getBRTDayWindowUTC) —
  // desloca de volta pra ler a data de calendário BRT correta.
  const [year, month, day] = new Date(yesterdayStartUTC.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .split("-")
    .map(Number);
  const dayCount = day; // dias corridos do mês atual, do dia 1 até ontem (inclusive)

  const currentStart = new Date(Date.UTC(year, month - 1, 1).valueOf() + BRT_OFFSET_HOURS * 60 * 60 * 1000);
  const currentEnd = new Date(yesterdayStartUTC.getTime() + 24 * 60 * 60 * 1000);

  const prevMonthFirstDay = new Date(Date.UTC(year, month - 2, 1));
  const prevYear = prevMonthFirstDay.getUTCFullYear();
  const prevMonthIndex = prevMonthFirstDay.getUTCMonth();
  const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonthIndex + 1, 0)).getUTCDate();
  const prevDayCount = Math.min(dayCount, daysInPrevMonth);

  const previousStart = new Date(Date.UTC(prevYear, prevMonthIndex, 1).valueOf() + BRT_OFFSET_HOURS * 60 * 60 * 1000);
  const previousEnd = new Date(
    Date.UTC(prevYear, prevMonthIndex, prevDayCount + 1).valueOf() + BRT_OFFSET_HOURS * 60 * 60 * 1000,
  );

  return { current: { startUTC: currentStart, endUTC: currentEnd }, previous: { startUTC: previousStart, endUTC: previousEnd } };
}

/**
 * Dado um array de ids (um por evento de clique/view), acha o id que mais se repete.
 * Usado pra achar "artigo/link/evento mais acessado" sem precisar de GROUP BY no banco —
 * o volume diário desse site é baixo o bastante pra contar em memória.
 */
export function findMostFrequent(ids: string[]): { id: string; count: number } | null {
  if (ids.length === 0) return null;
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  let topId = "";
  let topCount = 0;
  for (const [id, count] of counts) {
    if (count > topCount) {
      topId = id;
      topCount = count;
    }
  }
  return { id: topId, count: topCount };
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

export interface TopEntity {
  emoji: string;
  label: string;
  name: string;
  url: string | null;
  count: number;
}

export interface PeriodMetricResult {
  key: string;
  label: string;
  current: number;
  previous: number;
  variancePct: number | null;
}

export interface PeriodCardData {
  emoji: string;
  title: string;
  rangeLabel: string;
  rows: PeriodMetricResult[];
}

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function formatVariance(pct: number | null): string {
  if (pct === null) return '<span style="color:#999999">sem dado de comparação</span>';
  const arrow = pct >= 0 ? "▲" : "▼";
  const color = pct >= 0 ? "#4ade80" : "#f87171";
  return `<span style="color:${color}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

function buildMetricsRows(metrics: MetricResult[]): string {
  return metrics
    .map(
      (m) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;color:#eeeeee;font-size:13px;">${escapeHtml(m.label)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;text-align:right;color:#ffffff;font-weight:600;font-size:13px;">${m.yesterday}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;text-align:right;font-size:13px;">${formatVariance(m.varianceVsDayBeforePct)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;text-align:right;font-size:11px;color:#999999;">
            média 7d: ${m.baselineDailyAvg.toFixed(1)}${m.varianceVsBaselinePct !== null ? ` (${formatVariance(m.varianceVsBaselinePct)})` : ""}
          </td>
        </tr>`,
    )
    .join("");
}

function buildHighlightsSection(topEntities: TopEntity[]): string {
  const withData = topEntities.filter((t) => t.count > 0);
  if (withData.length === 0) return "";

  const rows = withData
    .map((t) => {
      const safeName = escapeHtml(t.name);
      const nameHtml = t.url
        ? `<a href="${escapeHtml(t.url)}" style="color:#c084fc;text-decoration:none;">${safeName}</a>`
        : safeName;
      const noun = t.count === 1 ? "acesso" : "acessos";
      return `
        <p style="margin:6px 0;color:#eeeeee;font-size:13px;line-height:1.4;">
          ${t.emoji} ${escapeHtml(t.label)}: <strong>${nameHtml}</strong>
          <span style="color:#999999;font-size:12px;">(${t.count} ${noun})</span>
        </p>`;
    })
    .join("");

  return `
    <tr>
      <td style="padding:4px 20px 4px;">
        <div style="background-color:#1a1a1a;border-radius:8px;padding:14px 16px;">
          <p style="margin:0 0 8px;color:#a855f7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🏆 Destaques de ontem</p>
          ${rows}
        </div>
      </td>
    </tr>`;
}

function buildPeriodCardHtml(card: PeriodCardData): string {
  const rows = card.rows
    .map(
      (r) => `
        <tr>
          <td style="padding:6px 0;color:#eeeeee;font-size:13px;">${escapeHtml(r.label)}</td>
          <td style="padding:6px 0;text-align:right;color:#ffffff;font-weight:600;font-size:13px;">${r.current}</td>
          <td style="padding:6px 0;text-align:right;font-size:12px;white-space:nowrap;">${formatVariance(r.variancePct)}</td>
        </tr>`,
    )
    .join("");

  return `
    <tr>
      <td style="padding:4px 20px 4px;">
        <div style="background-color:#1a1a1a;border-radius:8px;padding:14px 16px;">
          <p style="margin:0 0 2px;color:#a855f7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${card.emoji} ${escapeHtml(card.title)}</p>
          <p style="margin:0 0 8px;color:#999999;font-size:11px;">${escapeHtml(card.rangeLabel)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tbody>${rows}</tbody>
          </table>
        </div>
      </td>
    </tr>`;
}

export function buildEmailHtml(
  metrics: MetricResult[],
  dateLabel: string,
  topEntities: TopEntity[] = [],
  periodCards: PeriodCardData[] = [],
): string {
  const rows = buildMetricsRows(metrics);
  const highlights = buildHighlightsSection(topEntities);
  const periodCardsHtml = periodCards.map(buildPeriodCardHtml).join("");

  // Estrutura table-based (não <div> solto) com bgcolor+style redundantes nos
  // dois níveis de tabela e <meta color-scheme content="dark"> — mesmo padrão já
  // usado em weekly-digest-draft/blog-digest-draft. Sem isso, clientes que não
  // respeitam `background` em <div> (Outlook desktop) ou que tentam auto-inverter
  // cores de e-mails "sem esquema declarado" (Apple Mail/Gmail dark mode) caem
  // pro fundo branco padrão enquanto o texto continua nas cores claras pensadas
  // pro fundo escuro — texto branco sobre fundo branco, ilegível (ver R-020 em
  // docs/TESTING.md).
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Métricas Diárias — MDAccula</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#111111" style="background-color:#111111;max-width:600px;width:100%;border-radius:8px;border-collapse:collapse;font-family:system-ui,Arial,sans-serif;">
            <tr>
              <td align="center" style="padding:24px 20px 8px;">
                <img src="${SITE_URL}/logo-mdaccula.jpeg" alt="MDAccula" width="120" style="display:block;max-width:120px;width:100%;height:auto;border:0;outline:none;border-radius:8px;">
              </td>
            </tr>
            <tr>
              <td style="padding:4px 20px 4px;">
                <p style="margin:0;color:#a855f7;font-size:20px;font-weight:700;">📊 Métricas Diárias — MDAccula</p>
                <p style="margin:4px 0 0;color:#999999;font-size:13px;">Dados de ${escapeHtml(dateLabel)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">Métrica</th>
                      <th align="right" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">Ontem</th>
                      <th align="right" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">vs. Anteontem</th>
                      <th align="right" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">Média 7d</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </td>
            </tr>
            ${highlights}
            ${periodCardsHtml}
            <tr>
              <td style="padding:20px;">
                <p style="color:#666666;font-size:12px;margin:0;line-height:1.5;">
                  Enviado automaticamente todo dia às 08h (Brasília). Dashboard:
                  <a href="${SITE_URL}/admin/links-analytics" style="color:#a855f7;">Analytics de Links</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
