// supabase/functions/send-scheduled-email-campaigns/index.ts
import { createClient as createClient2 } from "npm:@supabase/supabase-js@2";

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
function egoiSendBodyIndicatesError(body) {
  return !!(body && typeof body === "object" && (body.error || body.errors || body.status === "error"));
}

// supabase/functions/_shared/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job"
};
function handleCorsPreFlight(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

// supabase/functions/send-scheduled-email-campaigns/index.ts
var MAX_ATTEMPTS = 3;
var BATCH_LIMIT = 20;
Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const envCronSecret = Deno.env.get("CRON_SHARED_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const admin = createClient2(supabaseUrl, serviceKey);
    let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
    if (!isCron && cronSecret) {
      const { data: row } = await admin.from("internal_cron_secrets").select("secret").eq("name", "scheduled_email_send_cron").maybeSingle();
      if (row?.secret && row.secret === cronSecret) isCron = true;
    }
    if (!authHeader && !isCron) return json({ error: "N\xE3o autenticado" }, 401);
    if (!isCron && authHeader) {
      const anonClient = createClient2(supabaseUrl, anonKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
      if (userErr || !userData.user) return json({ error: "Token inv\xE1lido" }, 401);
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin"
      });
      if (!isAdmin) return json({ error: "Apenas admins" }, 403);
    }
    const { data: masterRow } = await admin.from("site_settings").select("value").eq("key", "egoi_email_enabled").maybeSingle();
    if (masterRow?.value !== "true") {
      return json({ ok: true, skipped: true, reason: "master_off" });
    }
    const { data: cfg } = await admin.from("egoi_config").select("*").maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ ok: true, skipped: true, reason: "config_disabled_or_incomplete" });
    }
    const apiKey = Deno.env.get("EGOI_API_KEY");
    if (!apiKey) {
      return json({ ok: true, skipped: true, reason: "egoi_api_key_missing" });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const { data: dueRows, error: dueErr } = await admin.from("event_email_campaigns").select("id, event_id, egoi_campaign_id, scheduled_send_attempts").eq("status", "scheduled").is("scheduled_send_claimed_at", null).lte("scheduled_at", nowIso).order("scheduled_at", { ascending: true }).limit(BATCH_LIMIT);
    if (dueErr) throw dueErr;
    let sent = 0;
    let retried = 0;
    let failed = 0;
    for (const row of dueRows ?? []) {
      const { data: claimed } = await admin.from("event_email_campaigns").update({
        scheduled_send_claimed_at: nowIso,
        scheduled_send_attempts: row.scheduled_send_attempts + 1
      }).eq("id", row.id).is("scheduled_send_claimed_at", null).select("id, scheduled_send_attempts").maybeSingle();
      if (!claimed) continue;
      if (!row.egoi_campaign_id) {
        await admin.from("event_email_campaigns").update({ status: "failed", error_message: "Agendamento sem egoi_campaign_id" }).eq("id", row.id);
        failed++;
        continue;
      }
      const sendRes = await egoiRequest(
        `/campaigns/email/${encodeURIComponent(row.egoi_campaign_id)}/actions/send`,
        apiKey,
        { method: "POST", body: JSON.stringify({ list_id: Number(cfg.list_id) }) }
      );
      if (sendRes.ok && !egoiSendBodyIndicatesError(sendRes.body)) {
        await admin.from("event_email_campaigns").update({
          status: "sent",
          sent_at: (/* @__PURE__ */ new Date()).toISOString(),
          error_message: null
        }).eq("id", row.id);
        sent++;
        continue;
      }
      const errorMessage = `E-goi send ${sendRes.status}: ${typeof sendRes.body === "string" ? sendRes.body : JSON.stringify(sendRes.body)}`.slice(0, 1e3);
      if (claimed.scheduled_send_attempts < MAX_ATTEMPTS) {
        await admin.from("event_email_campaigns").update({ scheduled_send_claimed_at: null, error_message: errorMessage }).eq("id", row.id);
        retried++;
      } else {
        await admin.from("event_email_campaigns").update({ status: "failed", error_message: errorMessage }).eq("id", row.id);
        failed++;
      }
    }
    return json({ ok: true, processed: (dueRows ?? []).length, sent, retried, failed });
  } catch (e) {
    console.error("[send-scheduled-email-campaigns]", e);
    return json({ error: e.message }, 500);
  }
});
