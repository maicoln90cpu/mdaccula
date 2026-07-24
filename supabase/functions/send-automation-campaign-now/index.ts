// Dispara para envio real (lista inteira) um rascunho de automação (digest
// semanal / agenda FDS / blog news) já criado na E-goi — usado pelo botão
// "Enviar agora" na aba Automações. Antes desse endpoint, o único jeito de
// completar o envio era ir na própria plataforma da E-goi ou ligar "Enviar
// automaticamente no cron" e esperar o horário agendado.
//
// Reaproveita sendEgoiCampaign() — a MESMA função corrigida no bug 422
// segments.isEmpty (R-026, docs/TESTING.md) — nunca duplicar essa montagem
// de payload de novo.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleCorsPreFlight,
  jsonSuccess,
  jsonError,
  authorizeAdminOrCron,
} from "../_shared/index.ts";
import { sendEgoiCampaign } from "../_shared/egoiClient.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Sempre chamado pelo admin autenticado a partir da UI — nunca por cron —
  // mas reaproveita authorizeAdminOrCron (mesmo padrão do resto do projeto)
  // em vez de escrever um segundo caminho de autenticação.
  const auth = await authorizeAdminOrCron(req, admin, {
    anonKey,
    cronSecretRowName: "send_automation_campaign_now_cron",
    cronJobHeaderValue: "send-automation-campaign-now",
  });
  if (!auth.authorized) return jsonError(auth.message ?? "Não autorizado", auth.status);

  try {
    const body = await req.json().catch(() => ({}));
    const egoiCampaignId =
      typeof body?.egoi_campaign_id === "string" ? body.egoi_campaign_id.trim() : "";
    if (!egoiCampaignId) return jsonError("egoi_campaign_id é obrigatório", 400);

    const { data: masterRow } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "egoi_email_enabled")
      .maybeSingle();
    if (masterRow?.value !== "true") {
      return jsonSuccess({ skipped: true, reason: "master_off" });
    }

    const { data: cfg } = await admin.from("egoi_config").select("*").maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id) {
      return jsonSuccess({ skipped: true, reason: "config_disabled_or_incomplete" });
    }

    const apiKey = Deno.env.get("EGOI_API_KEY");
    if (!apiKey) return jsonError("EGOI_API_KEY não configurada", 500);

    const segmentId = cfg.segment_id != null ? Number(cfg.segment_id) : null;
    const result = await sendEgoiCampaign(egoiCampaignId, Number(cfg.list_id), apiKey, segmentId);

    if (!result.ok) {
      return jsonError(
        `E-goi recusou o envio (status ${result.status}): ${
          typeof result.body === "string" ? result.body : JSON.stringify(result.body)
        }`,
        502,
      );
    }

    return jsonSuccess({ success: true, egoi_campaign_id: egoiCampaignId });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err));
  }
});
