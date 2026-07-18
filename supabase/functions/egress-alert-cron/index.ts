/**
 * Cron diário: compara egress últimas 24h vs. média dos 7 dias anteriores.
 * Dispara e-mail (Resend) e grava histórico em egress_alerts quando:
 *   - Total 24h > threshold_mb configurado, OU
 *   - Total 24h > média 7 dias × ratio configurado (padrão 2×)
 *
 * Segurança: aceita x-cron-secret == CRON_SHARED_SECRET OU
 * x-cron-secret validado contra internal_cron_secrets (name='egress_alert_cron'),
 * OU Authorization Bearer de um admin autenticado (botão "Executar agora").
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  const cronJobHeader = req.headers.get("x-cron-job");
  const envCronSecret = Deno.env.get("CRON_SHARED_SECRET");

  let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
  if (!isCron && cronSecret && cronJobHeader) {
    const { data: row } = await supabase
      .from("internal_cron_secrets")
      .select("secret")
      .eq("name", "egress_alert_cron")
      .maybeSingle();
    if (row?.secret && row.secret === cronSecret) isCron = true;
  }

  if (!authHeader && !isCron) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!isCron && authHeader) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);
  }

  try {
    // Config
    const { data: settingsRows } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", [
        "egress_alert_enabled",
        "egress_alert_threshold_mb",
        "egress_alert_ratio",
        "egress_alert_email",
      ]);

    const cfg = new Map((settingsRows ?? []).map((r: any) => [r.key, r.value]));
    const enabled = cfg.get("egress_alert_enabled") ?? true;
    if (!enabled) return json({ skipped: "disabled" });

    const thresholdMb = Number(cfg.get("egress_alert_threshold_mb") ?? 500);
    const ratio = Number(cfg.get("egress_alert_ratio") ?? 2);
    const email = String(cfg.get("egress_alert_email") ?? "").trim();

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const start24h = new Date(now.getTime() - day).toISOString();
    const start7d = new Date(now.getTime() - 8 * day).toISOString();
    const end7d = start24h;

    // Últimas 24h
    const { data: last24h, error: e1 } = await supabase
      .from("egress_metrics")
      .select("egress_bytes")
      .gte("period_start", start24h);
    if (e1) throw e1;
    const bytes24h = (last24h ?? []).reduce((s: number, r: any) => s + Number(r.egress_bytes ?? 0), 0);

    // 7 dias anteriores (baseline)
    const { data: baselineRows, error: e2 } = await supabase
      .from("egress_metrics")
      .select("egress_bytes")
      .gte("period_start", start7d)
      .lt("period_start", end7d);
    if (e2) throw e2;
    const baselineTotal = (baselineRows ?? []).reduce((s: number, r: any) => s + Number(r.egress_bytes ?? 0), 0);
    const baselineDaily = baselineTotal / 7;

    const mb24h = bytes24h / (1024 * 1024);
    const observedRatio = baselineDaily > 0 ? bytes24h / baselineDaily : 0;

    const reasons: string[] = [];
    if (mb24h > thresholdMb) reasons.push(`total_24h_acima_de_${thresholdMb}MB`);
    if (baselineDaily > 0 && observedRatio > ratio) {
      reasons.push(`spike_${observedRatio.toFixed(2)}x_vs_media`);
    }

    if (reasons.length === 0) {
      return json({
        ok: true,
        alerted: false,
        bytes_24h: bytes24h,
        baseline_daily: Math.round(baselineDaily),
        mb_24h: mb24h.toFixed(2),
      });
    }

    // Top-3 paths (contexto no e-mail)
    const { data: topPaths } = await supabase
      .from("egress_metrics")
      .select("api_path, egress_bytes, source")
      .gte("period_start", start24h)
      .order("egress_bytes", { ascending: false })
      .limit(3);

    const reason = reasons.join(" & ");
    let emailSent = false;
    let emailError: string | null = null;

    if (email) {
      const RESEND = Deno.env.get("RESEND_API_KEY");
      const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
      if (RESEND && LOVABLE) {
        const html = `
          <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;padding:16px;">
            <h2 style="color:#a855f7;margin:0 0 8px">🚨 Alerta de Egress — MDACCULA</h2>
            <p style="color:#333">Motivo: <b>${reason}</b></p>
            <ul>
              <li><b>Últimas 24h:</b> ${mb24h.toFixed(2)} MB</li>
              <li><b>Média diária (7d):</b> ${(baselineDaily / (1024 * 1024)).toFixed(2)} MB</li>
              <li><b>Proporção:</b> ${observedRatio.toFixed(2)}×</li>
              <li><b>Limite configurado:</b> ${thresholdMb} MB / ratio ${ratio}×</li>
            </ul>
            <h3>Top caminhos (24h)</h3>
            <ol>
              ${(topPaths ?? [])
                .map(
                  (p: any) =>
                    `<li><code>${p.api_path}</code> — ${(Number(p.egress_bytes) / (1024 * 1024)).toFixed(2)} MB (${p.source})</li>`,
                )
                .join("")}
            </ol>
            <p style="color:#666;font-size:12px;margin-top:16px">
              Dashboard: <a href="https://mdaccula.com/admin/egress-monitor">Egress Monitor</a>
            </p>
          </div>`;
        try {
          const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE}`,
              "X-Connection-Api-Key": RESEND,
            },
            body: JSON.stringify({
              from: "MDACCULA Alertas <onboarding@resend.dev>",
              to: [email],
              subject: `[MDACCULA] Alerta de Egress: ${reason}`,
              html,
            }),
          });
          if (!resp.ok) {
            emailError = `${resp.status}: ${await resp.text()}`;
          } else {
            emailSent = true;
          }
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
        }
      } else {
        emailError = "RESEND_API_KEY or LOVABLE_API_KEY missing";
      }
    } else {
      emailError = "email destinatário não configurado (site_settings.egress_alert_email)";
    }

    // Persist
    await supabase.from("egress_alerts").insert({
      reason,
      window_bytes: bytes24h,
      baseline_bytes: Math.round(baselineDaily),
      ratio: Number(observedRatio.toFixed(2)),
      threshold_mb: thresholdMb,
      email_sent: emailSent,
      email_error: emailError,
      details: { top_paths: topPaths ?? [], reasons },
    });

    return json({
      ok: true,
      alerted: true,
      reason,
      bytes_24h: bytes24h,
      baseline_daily: Math.round(baselineDaily),
      ratio: observedRatio,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("egress-alert-cron error:", msg);
    return json({ error: msg }, 500);
  }
});
