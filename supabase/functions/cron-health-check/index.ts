/**
 * Cron diário (R-084): checa se os crons internos protegidos por
 * authorizeAdminOrCron (x-cron-secret) estão de fato rodando com sucesso,
 * não só "agendados". Existe porque cleanup-storage-weekly e
 * cleanup-sync-logs-weekly ficaram meses recebendo 401 (header errado) sem
 * nenhum alerta — o pg_cron sempre marca `net.http_post` como "succeeded",
 * já que só confirma o enfileiramento assíncrono da chamada HTTP, nunca o
 * status da resposta. Ver docs/PENDENCIAS.md e docs/CHANGELOG.md (20/08/2026).
 *
 * `_shared/index.ts` (authorizeAdminOrCron) grava um heartbeat em
 * `cron_job_health.last_success_at` toda vez que um cron passa no auth de
 * verdade. Esta function só compara esse carimbo com
 * `expected_max_gap_hours` — se algum job passou do prazo (ou nunca rodou),
 * dispara e-mail e grava em `cron_health_alerts`. Não cobre crons que não
 * usam `authorizeAdminOrCron` (alguns têm auth inline própria) nem qualquer
 * job não cadastrado em `cron_job_health` — ver README do arquivo de
 * migration que criou a tabela pra lista de cobertura.
 *
 * Segurança: mesmo padrão de authorizeAdminOrCron dos outros crons —
 * x-cron-secret validado contra internal_cron_secrets (name='cron_health_check_cron').
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCorsPreFlight, jsonSuccess, jsonError, authorizeAdminOrCron } from "../_shared/index.ts";
import { buildResendEmailRequest } from "../_shared/resendEmail.ts";

interface StaleJob {
  job_name: string;
  last_success_at: string | null;
  expected_max_gap_hours: number;
  gap_hours: number | null;
}

function buildAlertEmailHtml(staleJobs: StaleJob[], triggeredAtLabel: string): string {
  const rows = staleJobs
    .map((j) => {
      const lastRun = j.last_success_at
        ? new Date(j.last_success_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " BRT"
        : "nunca rodou com sucesso";
      const gap = j.gap_hours !== null ? `${j.gap_hours.toFixed(1)}h` : "—";
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;color:#eeeeee;font-size:13px;"><code>${j.job_name}</code></td>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;color:#f87171;font-size:13px;">${lastRun}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #262626;text-align:right;color:#f87171;font-size:13px;">${gap} (limite: ${j.expected_max_gap_hours}h)</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Alerta de Cron Parado — MDAccula</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#111111" style="background-color:#111111;max-width:600px;width:100%;border-radius:8px;border-collapse:collapse;font-family:system-ui,Arial,sans-serif;">
            <tr>
              <td style="padding:28px 20px 12px;">
                <p style="margin:0;color:#a855f7;font-size:24px;font-weight:700;">🚨 Cron(s) parado(s) — MDAccula</p>
                <p style="margin:8px 0 0;color:#999999;font-size:12px;">Checado em ${triggeredAtLabel}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 20px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">Job</th>
                      <th align="left" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">Última execução com sucesso</th>
                      <th align="right" style="padding:8px;color:#999999;font-size:11px;text-transform:uppercase;">Atraso</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 20px 24px;">
                <p style="color:#666666;font-size:12px;margin:0;line-height:1.6;">
                  Um cron aqui sem heartbeat recente costuma ser exatamente o mesmo padrão do incidente de
                  20/08/2026: header/secret errado fazendo a Edge Function rejeitar com 401, enquanto o
                  pg_cron marca a execução como "succeeded" sem checar a resposta. Conferir
                  <code>function_edge_logs</code> do job listado pra confirmar.
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

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const auth = await authorizeAdminOrCron(req, supabase, {
    anonKey,
    cronSecretRowName: "cron_health_check_cron",
    cronJobHeaderValue: "cron-health-check",
  });
  if (!auth.authorized) return jsonError(auth.message ?? "Não autorizado", auth.status);

  try {
    const { data: jobs, error } = await supabase
      .from("cron_job_health")
      .select("job_name, last_success_at, expected_max_gap_hours")
      .not("expected_max_gap_hours", "is", null);
    if (error) throw error;

    const now = Date.now();
    const staleJobs: StaleJob[] = (jobs ?? [])
      .map((j: { job_name: string; last_success_at: string | null; expected_max_gap_hours: number }) => {
        const gapHours = j.last_success_at ? (now - new Date(j.last_success_at).getTime()) / 3_600_000 : null;
        return {
          job_name: j.job_name,
          last_success_at: j.last_success_at,
          expected_max_gap_hours: j.expected_max_gap_hours,
          gap_hours: gapHours,
        };
      })
      .filter((j) => j.gap_hours === null || j.gap_hours > j.expected_max_gap_hours);

    if (staleJobs.length === 0) {
      return jsonSuccess({ ok: true, alerted: false, checked: (jobs ?? []).length });
    }

    const { data: settingsRows } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["egress_alert_email"]);
    const email = String(
      (settingsRows ?? []).find((r: { key: string }) => r.key === "egress_alert_email")?.value ?? "",
    ).trim();

    let emailSent = false;
    let emailError: string | null = null;
    const triggeredAtLabel =
      new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " BRT";

    if (email) {
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (RESEND) {
        try {
          const html = buildAlertEmailHtml(staleJobs, triggeredAtLabel);
          const req2 = buildResendEmailRequest({
            resendApiKey: RESEND,
            toEmail: email,
            subject: `[MDACCULA] ${staleJobs.length} cron(s) sem heartbeat recente`,
            html,
          });
          const resp = await fetch(req2.url, { method: "POST", headers: req2.headers, body: JSON.stringify(req2.body) });
          if (!resp.ok) {
            emailError = `${resp.status}: ${await resp.text()}`;
          } else {
            emailSent = true;
          }
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
        }
      } else {
        emailError = "RESEND_API_KEY missing";
      }
    } else {
      emailError = "email destinatário não configurado (site_settings.egress_alert_email)";
    }

    await supabase.from("cron_health_alerts").insert({
      stale_jobs: staleJobs,
      email_sent: emailSent,
      email_error: emailError,
    });

    return jsonSuccess({ ok: true, alerted: true, staleJobs, email_sent: emailSent, email_error: emailError });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron-health-check error:", msg);
    return jsonError(msg);
  }
});
