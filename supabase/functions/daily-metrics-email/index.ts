// Cron diário (08h BRT): coleta métricas do dia anterior (cliques em links,
// cliques no redirecionador, views de eventos/blog, compartilhamentos),
// compara com anteontem e com a média dos 7 dias anteriores, e envia um
// resumo por e-mail via Resend para contato@mdaccula.com.
//
// Segurança: mesmo padrão de authorizeAdminOrCron usado em scan-event-sources —
// aceita cron (internal_cron_secrets/CRON_SHARED_SECRET) OU admin autenticado.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, jsonSuccess, jsonError, authorizeAdminOrCron } from "../_shared/index.ts";
import { getBRTDayWindowUTC, computeVariancePct, buildEmailHtml, type MetricResult } from "./metrics.ts";

// Fixo no backend — nunca aceitar destino vindo do client (mesma regra de
// send-test-email/index.ts, regressão R-008).
const RECIPIENT = "contato@mdaccula.com";

const METRICS_CONFIG = [
  { key: "link_clicks", label: "Cliques no Linktree", table: "link_click_events", column: "clicked_at" },
  { key: "redirect_clicks", label: "Cliques no Redirecionador", table: "redirect_click_events", column: "clicked_at" },
  { key: "event_views", label: "Visualizações de Eventos", table: "event_view_events", column: "viewed_at" },
  { key: "blog_views", label: "Visualizações do Blog", table: "blog_view_events", column: "viewed_at" },
  { key: "shares", label: "Compartilhamentos", table: "share_analytics", column: "shared_at" },
] as const;

async function countInWindow(
  supabase: SupabaseClient,
  table: string,
  column: string,
  start: Date,
  end: Date,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(column, start.toISOString())
    .lt(column, end.toISOString());
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const auth = await authorizeAdminOrCron(req, admin, {
    anonKey,
    cronSecretRowName: "daily_metrics_email_cron",
    cronJobHeaderValue: "daily-metrics-email",
  });
  if (!auth.authorized) return jsonError(auth.message ?? "Não autorizado", auth.status);

  try {
    const yesterday = getBRTDayWindowUTC(1);
    const dayBefore = getBRTDayWindowUTC(2);
    const baselineStart = getBRTDayWindowUTC(8).startUTC;
    const baselineEnd = yesterday.startUTC;

    const metrics: MetricResult[] = [];

    for (const cfg of METRICS_CONFIG) {
      const [yesterdayCount, dayBeforeCount, baselineCount] = await Promise.all([
        countInWindow(admin, cfg.table, cfg.column, yesterday.startUTC, yesterday.endUTC),
        countInWindow(admin, cfg.table, cfg.column, dayBefore.startUTC, dayBefore.endUTC),
        countInWindow(admin, cfg.table, cfg.column, baselineStart, baselineEnd),
      ]);
      const baselineDailyAvg = baselineCount / 7;
      metrics.push({
        key: cfg.key,
        label: cfg.label,
        yesterday: yesterdayCount,
        dayBefore: dayBeforeCount,
        baselineDailyAvg,
        varianceVsDayBeforePct: computeVariancePct(yesterdayCount, dayBeforeCount),
        varianceVsBaselinePct: computeVariancePct(yesterdayCount, baselineDailyAvg),
      });
    }

    const dateLabel = yesterday.startUTC.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const html = buildEmailHtml(metrics, dateLabel);

    let emailSent = false;
    let emailError: string | null = null;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      emailError = "RESEND_API_KEY não configurada";
    } else {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "MDAccula <onboarding@resend.dev>",
            to: [RECIPIENT],
            subject: `📊 Métricas de ${dateLabel} — MDAccula`,
            html,
          }),
        });
        if (!resp.ok) {
          emailError = `${resp.status}: ${await resp.text()}`;
        } else {
          // Resend pode responder 2xx sem ter enfileirado a mensagem — o `id` no
          // corpo é a confirmação real (mesma regra de send-test-email, regressão R-008).
          const body = await resp.json().catch(() => null);
          if (!body?.id) {
            emailError = "Resend aceitou a requisição mas não retornou um ID de mensagem";
          } else {
            emailSent = true;
          }
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
      }
    }

    await admin.from("daily_metrics_email_log").insert({
      metrics: { date: dateLabel, results: metrics },
      email_sent: emailSent,
      email_error: emailError,
    });

    return jsonSuccess({
      success: true,
      date: dateLabel,
      metrics,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err));
  }
});
