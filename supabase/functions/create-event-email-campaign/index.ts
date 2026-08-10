// supabase/functions/create-event-email-campaign/index.ts
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
async function sendEgoiCampaign(campaignHash, listId, apiKey, segmentId) {
  const segments = segmentId ? { type: "segment", data: [String(segmentId)] } : { type: "none" };
  const res = await egoiRequest(
    `/campaigns/email/${encodeURIComponent(campaignHash)}/actions/send`,
    apiKey,
    { method: "POST", body: JSON.stringify({ list_id: listId, segments }) }
  );
  return {
    ok: res.ok && !egoiSendBodyIndicatesError(res.body),
    status: res.status,
    body: res.body
  };
}

// supabase/functions/_shared/bunnyUploadBytes.ts
var BUNNY_STORAGE_ZONE = "mdaccula";
var BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net";
function getBunnyStorageHost() {
  const hostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
  return hostname ? `https://${hostname}` : "https://storage.bunnycdn.com";
}
async function checkBunnyFile(path) {
  const url = `${BUNNY_CDN_HOST}/${path}`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return "exists";
    if (res.status === 404) return "not-found";
    console.warn(`[checkBunnyFile] HEAD ${url} -> ${res.status}`);
    return "error";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[checkBunnyFile] HEAD ${url} threw: ${msg}`);
    return "error";
  }
}
async function uploadBytesToBunny(buffer, path, contentType) {
  const apiKey = getBunnyStorageApiKey();
  if (!apiKey) {
    throw new Error("BUNNY_STORAGE_API_KEY not configured");
  }
  const url = `${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: apiKey,
      "Content-Type": contentType
    },
    body: buffer
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Bunny upload failed (${res.status}): ${text}`);
  }
  return { url: `${BUNNY_CDN_HOST}/${path}`, path };
}
function getBunnyStorageApiKey() {
  const raw = Deno.env.get("BUNNY_STORAGE_API_KEY") || "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/[^\x20-\x7E]/g, "");
}

// supabase/functions/_shared/mapImageStorage.ts
import { createClient } from "npm:@supabase/supabase-js@2";
var MAP_IMAGES_BUCKET = "event-map-images";
function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
}
async function storageGetFile(path) {
  try {
    const { data, error } = await getServiceClient().storage.from(MAP_IMAGES_BUCKET).download(path);
    if (error || !data) return null;
    return {
      bytes: await data.arrayBuffer(),
      contentType: data.type || "image/png"
    };
  } catch (err) {
    console.warn(`[mapImageStorage] download ${path} failed:`, err);
    return null;
  }
}
async function storageUploadFile(bytes, path, contentType) {
  try {
    const { error } = await getServiceClient().storage.from(MAP_IMAGES_BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (error) {
      console.warn(`[mapImageStorage] upload ${path} failed:`, error.message);
    }
  } catch (err) {
    console.warn(`[mapImageStorage] upload ${path} threw:`, err);
  }
}
function getStoragePublicUrl(path) {
  const { data } = getServiceClient().storage.from(MAP_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// supabase/functions/_shared/renderStaticMapCache.ts
function parseRenderStaticMapUrl(url) {
  try {
    const u = new URL(url, "https://localhost");
    const latRaw = u.searchParams.get("lat");
    const lngRaw = u.searchParams.get("lng");
    if (latRaw === null || lngRaw === null) return null;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    const zoom = Math.max(10, Math.min(19, Number(u.searchParams.get("zoom") || "15")));
    const w = Math.max(200, Math.min(640, Number(u.searchParams.get("w") || "600")));
    const h = Math.max(150, Math.min(400, Number(u.searchParams.get("h") || "300")));
    const rawStyle = u.searchParams.get("style") || "roadmap";
    const style = ["roadmap", "terrain", "satellite", "hybrid"].includes(rawStyle) ? rawStyle : "roadmap";
    const rawPinColor = (u.searchParams.get("pincolor") || "").trim();
    const pinColor = /^#[0-9a-fA-F]{6}$/.test(rawPinColor) ? rawPinColor : /^[a-zA-Z]+$/.test(rawPinColor) ? rawPinColor : "red";
    return { lat, lng, zoom, w, h, style, pinColor };
  } catch {
    return null;
  }
}
function hashParams(params) {
  const data = `${params.lat.toFixed(6)},${params.lng.toFixed(6)},${params.zoom},${params.w}x${params.h},${params.style},${params.pinColor}`;
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
function buildMapPath(params) {
  const h = hashParams(params);
  return `email-map-images/map-${h}-${params.lat.toFixed(4)}-${params.lng.toFixed(4)}-z${params.zoom}-${params.w}x${params.h}-${params.style}-${params.pinColor.replace("#", "")}.png`;
}
async function resolveMapImage(params, generateImage) {
  const path = buildMapPath(params);
  const bunnyCheck = await checkBunnyFile(path);
  if (bunnyCheck === "exists") {
    return { source: "bunny", bunnyUrl: `https://mdaccula.b-cdn.net/${path}` };
  }
  const storageHit = await storageGetFile(path);
  if (storageHit) {
    uploadBytesToBunny(storageHit.bytes, path, storageHit.contentType).catch((err) => {
      console.warn(`[resolveMapImage] self-heal upload to Bunny failed for ${path}:`, err);
    });
    return {
      source: "storage",
      bytes: storageHit.bytes,
      contentType: storageHit.contentType,
      storageUrl: `${path}`
    };
  }
  const response = await generateImage();
  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    throw new Error(`map image generation failed (${response.status}): ${text}`);
  }
  const contentType = response.headers.get("Content-Type") || "image/png";
  const buffer = await response.arrayBuffer();
  try {
    const { url: bunnyUrl } = await uploadBytesToBunny(buffer, path, contentType);
    storageUploadFile(buffer, path, contentType).catch((err) => {
      console.warn(`[resolveMapImage] Storage backup failed for ${path}:`, err);
    });
    return { source: "generated", bytes: buffer, contentType, bunnyUrl };
  } catch (err) {
    console.warn(`[resolveMapImage] Bunny upload failed for ${path}, falling back to Storage:`, err);
    await storageUploadFile(buffer, path, contentType);
    return { source: "generated-fallback", bytes: buffer, contentType, storageUrl: path };
  }
}
async function ensureCachedMapImage(params, renderStaticMapUrl) {
  const resolved = await resolveMapImage(params, () => fetch(renderStaticMapUrl));
  if (resolved.source === "bunny" || resolved.source === "generated") {
    return resolved.bunnyUrl;
  }
  return getStoragePublicUrl(resolved.storageUrl);
}
async function cacheStaticMapImagesInHtml(html) {
  if (!html.includes("render-static-map")) return html;
  const imgUrlRegex = /<img[^>]+src=["']([^"']*render-static-map[^"']*)["'][^>]*>/gi;
  const matches = [];
  let match;
  while ((match = imgUrlRegex.exec(html)) !== null) {
    matches.push({ fullMatch: match[0], url: match[1] });
  }
  if (matches.length === 0) return html;
  let result = html;
  for (const { fullMatch, url } of matches) {
    try {
      const decodedUrl = url.replace(/&amp;/g, "&");
      const params = parseRenderStaticMapUrl(decodedUrl);
      if (!params) continue;
      const cachedUrl = await ensureCachedMapImage(params, decodedUrl);
      result = result.replaceAll(fullMatch, fullMatch.replaceAll(url, cachedUrl));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cacheStaticMapImagesInHtml] failed to cache ${url}: ${msg}`);
    }
  }
  return result;
}

// supabase/functions/create-event-email-campaign/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
var DISPATCH_CLAIM_STALE_MS = 15e3;
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
    const anonClient = createClient2(supabaseUrl, anonKey);
    const admin = createClient2(supabaseUrl, serviceKey);
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
    const segmentOverrideProvided = Object.prototype.hasOwnProperty.call(body, "segment_id");
    const segmentIdOverride = segmentOverrideProvided ? body?.segment_id != null ? Number(body.segment_id) : null : void 0;
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
    const resolvedSegmentId = segmentOverrideProvided ? segmentIdOverride : cfg.segment_id != null ? Number(cfg.segment_id) : null;
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
      const staleClaimBefore = new Date(Date.now() - DISPATCH_CLAIM_STALE_MS).toISOString().replace(/\.\d+Z$/, "Z");
      let claimQuery = admin.from("events").update({ email_campaign_dispatched_at: now }).eq("id", eventId);
      claimQuery = forceResend ? claimQuery.or(
        `email_campaign_dispatched_at.is.null,email_campaign_dispatched_at.lt.${staleClaimBefore}`
      ) : claimQuery.is("email_campaign_dispatched_at", null);
      const { data: claimed, error: claimErr } = await claimQuery.select("id,title,status,email_campaign_dispatched_at").maybeSingle();
      if (claimErr) throw claimErr;
      if (!claimed) {
        return json({
          skipped: true,
          reason: forceResend ? "dispatch_in_progress" : "already_dispatched"
        });
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
      weekend_agenda: "agenda-fds",
      promo: "promocao"
    };
    const typeTag = typeTagMap[templateType] || "evento-novo";
    const tags = ["mdaccula", typeTag];
    if (isAbTest) {
      tags.push("ab-test", `variante-${abVariant}`);
    }
    let processedHtml = html;
    try {
      processedHtml = await cacheStaticMapImagesInHtml(html);
    } catch (cacheErr) {
      const msg = cacheErr instanceof Error ? cacheErr.message : String(cacheErr);
      console.warn("[create-event-email-campaign] cacheStaticMapImagesInHtml fallback:", msg);
      processedHtml = html;
    }
    const createPayload = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject: finalSubject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: "html",
        body: processedHtml,
        ...preheader ? { preheader } : {},
        ...textVersion ? { text: textVersion } : {}
      },
      tags
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    if (resolvedSegmentId) createPayload.segment_id = resolvedSegmentId;
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
        const sendRes = await sendEgoiCampaign(
          campaignHash,
          Number(cfg.list_id),
          apiKey,
          resolvedSegmentId
        );
        egoiSendStatus = sendRes.status;
        egoiSendBody = sendRes.body;
        if (sendRes.ok) {
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
      segment_id: resolvedSegmentId,
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
    console.error("[create-event-email-campaign] Falha n\xE3o tratada:", e);
    return json({ error: e.message }, 500);
  }
});
