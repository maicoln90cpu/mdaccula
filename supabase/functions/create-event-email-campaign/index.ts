// supabase/functions/create-event-email-campaign/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/egoiClient.ts
var EGOI_BASE_URL = "https://api.egoiapp.com";
async function egoiRequest(path, apiKey, init = {}) {
  const res = await fetch(`${EGOI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Apikey: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers || {}
    }
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
  }
  return { status: res.status, ok: res.ok, body };
}

// supabase/functions/create-event-email-campaign/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "N\xE3o autenticado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const anonClient = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Token inv\xE1lido" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin"
    });
    if (!isAdmin) return json({ error: "Apenas admins" }, 403);
    const body = await req.json().catch(() => ({}));
    const eventId = body?.event_id;
    const html = body?.html;
    const subject = body?.subject || void 0;
    const preheader = body?.preheader || void 0;
    const textVersion = body?.text || void 0;
    const templateType = body?.template_type || "event_new";
    const forceResend = body?.force_resend === true;
    const sendNow = body?.send_now === true;
    const abGroupId = body?.ab_group_id || null;
    const abVariant = body?.ab_variant || null;
    const abTestConfig = body?.ab_test_config || null;
    const isAbTest = !!abGroupId && !!abVariant;
    const scheduleAtRaw = body?.schedule_at || void 0;
    if (!eventId || !html) {
      return json({ error: "event_id e html s\xE3o obrigat\xF3rios" }, 400);
    }
    if (isAbTest && !["A", "B"].includes(abVariant)) {
      return json({ error: "ab_variant deve ser A ou B" }, 400);
    }
    if (scheduleAtRaw && sendNow) {
      return json({ error: "schedule_at e send_now s\xE3o mutuamente exclusivos" }, 400);
    }
    let scheduleAtIso = null;
    if (scheduleAtRaw) {
      const scheduleAtMs = Date.parse(scheduleAtRaw);
      if (Number.isNaN(scheduleAtMs)) {
        return json({ error: "schedule_at inv\xE1lido" }, 400);
      }
      if (scheduleAtMs < Date.now() + 6e4) {
        return json({ error: "schedule_at precisa ser pelo menos 1 minuto no futuro" }, 400);
      }
      scheduleAtIso = new Date(scheduleAtMs).toISOString();
    }
    const { data: masterRow } = await admin.from("site_settings").select("value").eq("key", "egoi_email_enabled").maybeSingle();
    if (masterRow?.value !== "true") {
      return json({ skipped: true, reason: "master_off" });
    }
    const { data: cfg } = await admin.from("egoi_config").select("*").maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ skipped: true, reason: "config_disabled_or_incomplete" });
    }
    let claimedTitle = null;
    let claimedStatus = null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (isAbTest) {
      const { data: ev } = await admin.from("events").select("id,title,status").eq("id", eventId).maybeSingle();
      if (!ev) return json({ error: "Evento n\xE3o encontrado" }, 404);
      if (ev.status !== "active") return json({ skipped: true, reason: "event_not_active" });
      claimedTitle = ev.title;
      claimedStatus = ev.status;
    } else {
      if (forceResend) {
        await admin.from("events").update({ email_campaign_dispatched_at: null }).eq("id", eventId);
      }
      const { data: claimed, error: claimErr } = await admin.from("events").update({ email_campaign_dispatched_at: now }).eq("id", eventId).is("email_campaign_dispatched_at", null).select("id,title,status").maybeSingle();
      if (claimErr) throw claimErr;
      if (!claimed) {
        return json({ skipped: true, reason: "already_dispatched" });
      }
      if (claimed.status !== "active") {
        await admin.from("events").update({ email_campaign_dispatched_at: null }).eq("id", eventId);
        return json({ skipped: true, reason: "event_not_active" });
      }
      claimedTitle = claimed.title;
      claimedStatus = claimed.status;
    }
    const apiKey = Deno.env.get("EGOI_API_KEY");
    if (!apiKey) {
      if (!isAbTest) {
        await admin.from("events").update({ email_campaign_dispatched_at: null }).eq("id", eventId);
      }
      return json({ error: "EGOI_API_KEY n\xE3o configurada" }, 500);
    }
    let reuseRow = null;
    if (!isAbTest) {
      const { data: lastCampaign } = await admin.from("event_email_campaigns").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      reuseRow = lastCampaign && lastCampaign.status !== "sent" ? lastCampaign : null;
    }
    const mode = sendNow ? "immediate" : scheduleAtIso ? "scheduled" : cfg.mode || "draft";
    const abSuffix = isAbTest ? ` \u2022 A/B ${abVariant}` : "";
    const internalName = `MDAccula \u2022 ${claimedTitle || "Evento"} \u2022 ${now.slice(0, 10)}${abSuffix}`;
    const finalSubject = subject?.trim();
    if (!finalSubject) {
      if (!isAbTest) {
        await admin.from("events").update({ email_campaign_dispatched_at: null }).eq("id", eventId);
      }
      return json({ error: "Assunto do template est\xE1 vazio" }, 400);
    }
    const typeTagMap = {
      event_new: "evento-novo",
      courtesy: "cortesia",
      weekly_digest: "digest-semanal",
      weekly_digest_editorial: "digest-editorial",
      weekend_agenda: "agenda-fds"
    };
    const typeTag = typeTagMap[templateType] || "evento-novo";
    const tags = ["mdaccula", typeTag];
    if (isAbTest) {
      tags.push("ab-test", `variante-${abVariant}`);
    }
    const createPayload = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject: finalSubject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: "html",
        body: html,
        ...preheader ? { preheader } : {},
        ...textVersion ? { text: textVersion } : {}
      },
      tags
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    if (cfg.segment_id) createPayload.segment_id = Number(cfg.segment_id);
    const created = await egoiRequest("/campaigns/email", apiKey, {
      method: "POST",
      body: JSON.stringify(createPayload)
    });
    let campaignHash = null;
    let campaignStatus = "failed";
    let errorMessage = null;
    let sentAt = null;
    let egoiSendStatus = null;
    let egoiSendBody = null;
    if (created.ok) {
      campaignHash = created.body?.campaign_hash || created.body?.hash || created.body?.data?.campaign_hash || (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) || (created.body?.id != null ? String(created.body.id) : null);
      campaignStatus = "draft";
      if (scheduleAtIso && !campaignHash) {
        errorMessage = `Campanha criada na E-goi, mas n\xE3o foi poss\xEDvel extrair o hash pra agendar o envio (campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (scheduleAtIso && campaignHash) {
        campaignStatus = "scheduled";
      }
      if (sendNow && !campaignHash) {
        errorMessage = `Campanha criada na E-goi, mas n\xE3o foi poss\xEDvel extrair o hash pra confirmar o envio (campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (sendNow && campaignHash) {
        const sendRes = await egoiRequest(
          `/campaigns/email/${encodeURIComponent(campaignHash)}/actions/send`,
          apiKey,
          { method: "POST", body: JSON.stringify({ list_id: Number(cfg.list_id) }) }
        );
        egoiSendStatus = sendRes.status;
        egoiSendBody = sendRes.body;
        const bodyIndicatesError = sendRes.body && typeof sendRes.body === "object" && (sendRes.body.error || sendRes.body.errors || sendRes.body.status === "error");
        if (sendRes.ok && !bodyIndicatesError) {
          campaignStatus = "sent";
          sentAt = (/* @__PURE__ */ new Date()).toISOString();
        } else {
          errorMessage = `E-goi send ${sendRes.status}: ${typeof sendRes.body === "string" ? sendRes.body : JSON.stringify(sendRes.body)}`.slice(0, 1e3);
        }
      }
    } else {
      if (!isAbTest) {
        await admin.from("events").update({ email_campaign_dispatched_at: null }).eq("id", eventId);
      }
      errorMessage = `E-goi ${created.status}: ${typeof created.body === "string" ? created.body : JSON.stringify(created.body)}`.slice(0, 1e3);
    }
    const rowPayload = {
      event_id: eventId,
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      mode,
      error_message: errorMessage,
      sent_at: sentAt,
      campaign_type: isAbTest ? "ab_subject" : "standard",
      ab_group_id: abGroupId,
      ab_variant: abVariant,
      ab_test_config: abTestConfig,
      // Reseta o estado de agendamento a cada (re)criação — inclusive quando
      // NÃO é um agendamento (scheduleAtIso null), para limpar um agendamento
      // anterior caso esta linha esteja sendo reaproveitada (reuseRow).
      scheduled_at: scheduleAtIso,
      scheduled_send_claimed_at: null,
      scheduled_send_attempts: 0
    };
    if (reuseRow) {
      await admin.from("event_email_campaigns").update(rowPayload).eq("id", reuseRow.id);
    } else {
      await admin.from("event_email_campaigns").insert(rowPayload);
    }
    return json({
      ok: campaignStatus !== "failed",
      status: campaignStatus,
      egoi_campaign_id: campaignHash,
      error: errorMessage,
      scheduled_at: campaignStatus === "scheduled" ? scheduleAtIso : null,
      _debug: { egoi_status: created.status, egoi_send_status: egoiSendStatus, egoi_send_body: egoiSendBody }
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
