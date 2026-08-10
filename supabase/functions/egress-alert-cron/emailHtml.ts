// HTML do e-mail de alerta de egress — mesmo padrão visual (table-based,
// tema escuro, <meta color-scheme content="dark">) do e-mail diário de
// métricas (daily-metrics-email/metrics.ts:buildEmailHtml), pra não ter dois
// e-mails do mesmo sistema com identidade visual diferente. Diferença
// intencional: aqui é um alerta de problema, não um resumo neutro — os
// números que efetivamente causaram o disparo (24h, proporção) saem em
// vermelho (#f87171, mesma cor de variação negativa no e-mail diário) em vez
// de branco neutro, pra saltar aos olhos.
const SITE_URL = "https://mdaccula.com";

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface AlertTopPath {
  api_path: string;
  egress_bytes: number;
  source: string;
}

export interface AlertEmailParams {
  reason: string;
  mb24h: number;
  baselineDailyMb: number;
  observedRatio: number;
  thresholdMb: number;
  ratioThreshold: number;
  topPaths: AlertTopPath[];
  triggeredAtLabel: string;
}

const RED = "#f87171";
const WHITE = "#ffffff";
const GRAY = "#999999";

function buildStatRow(label: string, value: string, valueColor: string, note?: string): string {
  return `
    <tr>
      <td style="padding:13px 8px;border-bottom:1px solid #262626;color:#eeeeee;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:13px 8px;border-bottom:1px solid #262626;text-align:right;color:${valueColor};font-weight:700;font-size:14px;">${escapeHtml(value)}</td>
      <td style="padding:13px 8px;border-bottom:1px solid #262626;text-align:right;font-size:11px;color:${GRAY};">${note ? escapeHtml(note) : ""}</td>
    </tr>`;
}

function buildTopPathsSection(topPaths: AlertTopPath[]): string {
  if (topPaths.length === 0) return "";

  const rows = topPaths
    .map((p, i) => {
      const mb = (Number(p.egress_bytes) / (1024 * 1024)).toFixed(2);
      // O maior contribuinte (i === 0) sai em vermelho — é o suspeito nº1 do pico.
      const color = i === 0 ? RED : WHITE;
      return `
        <p style="margin:0 0 10px;color:#eeeeee;font-size:13px;line-height:1.5;">
          <code style="color:${color};font-weight:${i === 0 ? "700" : "400"};">${escapeHtml(p.api_path)}</code>
          <span style="color:${GRAY};font-size:12px;"> — ${mb} MB (${escapeHtml(p.source)})</span>
        </p>`;
    })
    .join("");

  return `
    <tr>
      <td style="padding:10px 20px;">
        <div style="background-color:#1a1a1a;border-radius:10px;padding:20px 22px;">
          <p style="margin:0 0 14px;color:#a855f7;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">🔍 Top caminhos (últimas 24h)</p>
          ${rows}
        </div>
      </td>
    </tr>`;
}

export function buildAlertEmailHtml(params: AlertEmailParams): string {
  const {
    reason,
    mb24h,
    baselineDailyMb,
    observedRatio,
    thresholdMb,
    ratioThreshold,
    topPaths,
    triggeredAtLabel,
  } = params;

  const statsRows =
    buildStatRow("Últimas 24h", `${mb24h.toFixed(2)} MB`, RED, `limite: ${thresholdMb} MB`) +
    buildStatRow("Média diária (7d)", `${baselineDailyMb.toFixed(2)} MB`, WHITE) +
    buildStatRow("Proporção vs. média", `${observedRatio.toFixed(2)}×`, RED, `limite: ${ratioThreshold}×`);

  const topPathsHtml = buildTopPathsSection(topPaths);

  // Mesma estrutura table-based + bgcolor redundante + color-scheme dark do
  // e-mail diário de métricas (ver comentário em metrics.ts:buildEmailHtml) —
  // sem isso, Outlook/Apple Mail/Gmail em dark mode podem inverter só o
  // fundo e deixar texto claro sobre fundo claro (R-020).
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Alerta de Egress — MDAccula</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#111111" style="background-color:#111111;max-width:600px;width:100%;border-radius:8px;border-collapse:collapse;font-family:system-ui,Arial,sans-serif;">
            <tr>
              <td align="center" style="padding:32px 20px 12px;">
                <img src="${SITE_URL}/logo-mdaccula.jpeg" alt="MDAccula" width="130" style="display:block;max-width:130px;width:100%;height:auto;border:0;outline:none;border-radius:8px;">
              </td>
            </tr>
            <tr>
              <td style="padding:8px 20px 12px;">
                <p style="margin:0;color:#a855f7;font-size:26px;font-weight:700;line-height:1.25;">🚨 Alerta de Egress — MDAccula</p>
                <p style="margin:8px 0 0;color:${RED};font-size:14px;font-weight:600;">${escapeHtml(reason)}</p>
                <p style="margin:6px 0 0;color:${GRAY};font-size:12px;">Disparado em ${escapeHtml(triggeredAtLabel)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px 4px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:10px 8px;color:${GRAY};font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">Indicador</th>
                      <th align="right" style="padding:10px 8px;color:${GRAY};font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">Valor</th>
                      <th align="right" style="padding:10px 8px;color:${GRAY};font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">Referência</th>
                    </tr>
                  </thead>
                  <tbody>${statsRows}</tbody>
                </table>
              </td>
            </tr>
            ${topPathsHtml}
            <tr>
              <td style="padding:28px 20px 24px;">
                <p style="color:#666666;font-size:12px;margin:0;line-height:1.6;">
                  Alerta automático de uso de egress. Dashboard:
                  <a href="${SITE_URL}/admin/egress-monitor" style="color:#a855f7;">Egress Monitor</a>
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
