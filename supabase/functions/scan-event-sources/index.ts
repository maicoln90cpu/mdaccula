// supabase/functions/scan-event-sources/index.ts
import { createClient as createClient2 } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

// supabase/functions/_shared/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
function jsonSuccess(data = { success: true }, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function handleError(error, functionName) {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonError(message, 500);
}
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function scrapeWithFirecrawl(url, apiKey, timeoutMs = 1e4) {
  try {
    const response = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 1500
        })
      },
      timeoutMs
    );
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data.success && data.data?.markdown) {
      return { success: true, markdown: data.data.markdown };
    }
    return { success: false, error: "No markdown content returned" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Timeout" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
async function authorizeAdminOrCron(req, admin, opts) {
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const cronJobHeader = req.headers.get("x-cron-job");
  if (cronSecretHeader && cronJobHeader === opts.cronJobHeaderValue) {
    const { data: row } = await admin.from("internal_cron_secrets").select("secret").eq("name", opts.cronSecretRowName).maybeSingle();
    if (row?.secret && row.secret === cronSecretHeader) {
      return { authorized: true, status: 200 };
    }
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { authorized: false, status: 401, message: "N\xE3o autenticado" };
  const anonClient = createClient(Deno.env.get("SUPABASE_URL"), opts.anonKey);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData.user) return { authorized: false, status: 401, message: "Token inv\xE1lido" };
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin"
  });
  if (!isAdmin) return { authorized: false, status: 403, message: "Apenas admins" };
  return { authorized: true, status: 200 };
}

// supabase/functions/scan-event-sources/dedupe.ts
function normalizeTitle(title) {
  return title.normalize("NFKD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function isDuplicateEvent(candidate, existing) {
  const normalizedCandidate = normalizeTitle(candidate.title);
  return existing.some(
    (e) => e.date === candidate.date && normalizeTitle(e.title) === normalizedCandidate
  );
}

// supabase/functions/scan-event-sources/extract.ts
var EXTRACTION_SYSTEM_PROMPT = `Voc\xEA \xE9 um assistente que extrai dados estruturados de an\xFAncios de eventos de m\xFAsica eletr\xF4nica a partir de texto raspado de sites de terceiros.

Regras:
- Extraia apenas informa\xE7\xF5es EXPLICITAMENTE presentes no texto. NUNCA invente data, local, hor\xE1rio ou lineup.
- Se o conte\xFAdo n\xE3o anuncia nenhum evento (ex: p\xE1gina institucional, not\xEDcia gen\xE9rica, index de blog), retorne has_event=false.
- Se um campo n\xE3o est\xE1 claro no texto, deixe-o nulo/vazio \u2014 nunca adivinhe.
- confidence="high" s\xF3 quando data, local e nome do evento est\xE3o todos claramente presentes; "medium" quando falta 1 desses; "low" caso contr\xE1rio.
- No campo "description", NUNCA inclua o nome do site/ve\xEDculo/marca de onde este texto foi raspado (ex: n\xE3o escreva "segundo o [nome do site]" ou repita o nome da fonte) \u2014 extraia s\xF3 o fato sobre o evento em si.
- O conte\xFAdo raspado est\xE1 em markdown e pode conter links no formato [texto](url). Se houver um link espec\xEDfico apontando para a p\xE1gina de detalhe/not\xEDcia DESTE evento em particular (ex: "saiba mais", "ver evento", o pr\xF3prio t\xEDtulo do evento como link, "leia a mat\xE9ria completa") \u2014 diferente da URL raiz da fonte \u2014, extraia essa URL em "source_page_url". Se n\xE3o houver um link assim identific\xE1vel (ex: o evento est\xE1 descrito s\xF3 em texto corrido, sem link pr\xF3prio), deixe "source_page_url" vazio/nulo \u2014 NUNCA invente ou reutilize a URL raiz da fonte como se fosse a p\xE1gina espec\xEDfica.
- O conte\xFAdo tamb\xE9m pode conter imagens no formato markdown ![alt](url). Se houver uma imagem claramente associada a ESTE evento espec\xEDfico (ex: flyer, cartaz, foto de divulga\xE7\xE3o \u2014 geralmente perto do t\xEDtulo/descri\xE7\xE3o do evento), extraia sua URL em "image_url". IGNORE \xEDcones pequenos, logos do site, avatares, imagens gen\xE9ricas de navega\xE7\xE3o ou banners de outros eventos. Se n\xE3o houver uma imagem claramente ligada a este evento, deixe "image_url" vazio/nulo \u2014 NUNCA invente uma URL de imagem.`;
function buildExtractionRequest(modelName, source, markdown) {
  const userPrompt = `Fonte: ${source.name} (${source.url})

Conte\xFAdo raspado:
${markdown}

Extraia os dados do evento anunciado neste conte\xFAdo, se houver algum.`;
  return {
    model: modelName,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_event",
          description: "Extrai dados estruturados de um evento de m\xFAsica eletr\xF4nica anunciado no texto, se houver",
          parameters: {
            type: "object",
            properties: {
              has_event: { type: "boolean", description: "true se o texto anuncia um evento real" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              title: { type: "string" },
              date: { type: "string", description: "Formato YYYY-MM-DD" },
              time: { type: "string", description: "Formato HH:MM, 24h" },
              venue: { type: "string" },
              address: { type: "string" },
              location_city: { type: "string" },
              location_state: { type: "string", description: "UF de 2 letras" },
              lineup: { type: "array", items: { type: "string" } },
              ticket_link: { type: "string" },
              description: { type: "string" },
              source_page_url: {
                type: "string",
                description: "URL exata da p\xE1gina/not\xEDcia deste evento espec\xEDfico, extra\xEDda de um link markdown presente no conte\xFAdo \u2014 nunca a URL raiz da fonte, deixe vazio se n\xE3o houver link espec\xEDfico"
              },
              image_url: {
                type: "string",
                description: "URL de uma imagem (flyer/cartaz/foto) claramente associada a este evento espec\xEDfico, extra\xEDda de um ![alt](url) presente no conte\xFAdo \u2014 nunca \xEDcones/logos/imagens gen\xE9ricas, deixe vazio se n\xE3o houver imagem clara"
              }
            },
            required: ["has_event", "confidence"]
          }
        }
      }
    ],
    tool_choice: { type: "function", function: { name: "extract_event" } }
  };
}
function parseExtractionResponse(aiData) {
  const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;
  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }
  if (typeof args !== "object" || args === null) return null;
  if (args.has_event !== true) return null;
  if (typeof args.title !== "string" || typeof args.date !== "string") return null;
  return {
    title: args.title,
    date: args.date,
    time: typeof args.time === "string" && args.time ? args.time : null,
    venue: typeof args.venue === "string" && args.venue ? args.venue : null,
    address: typeof args.address === "string" && args.address ? args.address : null,
    location_city: typeof args.location_city === "string" && args.location_city ? args.location_city : null,
    location_state: typeof args.location_state === "string" && args.location_state ? args.location_state : null,
    lineup: Array.isArray(args.lineup) ? args.lineup.filter((x) => typeof x === "string") : [],
    ticket_link: typeof args.ticket_link === "string" && args.ticket_link ? args.ticket_link : null,
    description: typeof args.description === "string" && args.description ? args.description : null,
    confidence: ["high", "medium", "low"].includes(args.confidence) ? args.confidence : "low",
    source_page_url: typeof args.source_page_url === "string" && /^https?:\/\//.test(args.source_page_url) ? args.source_page_url : null,
    image_url: typeof args.image_url === "string" && /^https?:\/\//.test(args.image_url) ? args.image_url : null
  };
}

// supabase/functions/scan-event-sources/index.ts
var SCRAPE_TIMEOUT_MS = 1e4;
var AI_TIMEOUT_MS = 6e4;
var MAX_CONTENT_LENGTH = 4e3;
var GENERATE_TIMEOUT_MS = 12e4;
var IMAGE_FETCH_TIMEOUT_MS = 1e4;
function extractInstagramUsername(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0] || null;
  } catch {
    return trimmed.replace(/^@/, "") || null;
  }
}
async function rehostImageToBunny(imageUrl) {
  try {
    const bunnyKey = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, "")?.replace(/[^\x20-\x7E]/g, "");
    if (!bunnyKey) return null;
    const imgResp = await fetchWithTimeout(imageUrl, {}, IMAGE_FETCH_TIMEOUT_MS);
    if (!imgResp.ok) return null;
    const rawBuffer = new Uint8Array(await imgResp.arrayBuffer());
    if (rawBuffer.length < 2048) return null;
    let finalBuffer;
    try {
      const image = await Image.decode(rawBuffer);
      const maxDimension = 1024;
      if (image.width > maxDimension || image.height > maxDimension) {
        const scale = maxDimension / Math.max(image.width, image.height);
        image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
      }
      finalBuffer = await image.encodeWEBP(85);
    } catch {
      return null;
    }
    const fileName = `event-scraped-${Date.now()}.webp`;
    const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
    const uploadResp = await fetch(`https://${bunnyHostname}/mdaccula/event-images/${fileName}`, {
      method: "PUT",
      headers: { AccessKey: bunnyKey, "Content-Type": "image/webp" },
      body: finalBuffer
    });
    if (!uploadResp.ok) return null;
    return `https://mdaccula.b-cdn.net/event-images/${fileName}`;
  } catch (error) {
    console.error("[scan-event-sources] rehostImageToBunny falhou:", error);
    return null;
  }
}
var COMPOSE_IMAGE_TIMEOUT_MS = 3e4;
async function composeEventImage(supabaseUrl, serviceKey, imageUrl, title) {
  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/compose-event-image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ imageUrl, title })
      },
      COMPOSE_IMAGE_TIMEOUT_MS
    );
    if (!response.ok) return imageUrl;
    const data = await response.json();
    return typeof data?.imageUrl === "string" ? data.imageUrl : imageUrl;
  } catch (error) {
    console.error("[scan-event-sources] composeEventImage falhou, usando imagem sem marca:", error);
    return imageUrl;
  }
}
async function generateDraftArticle(admin, supabaseUrl, serviceKey, draftId, extracted, templateId, autoPublish) {
  try {
    const rehostedImageUrl = extracted.image_url ? await rehostImageToBunny(extracted.image_url) : null;
    const finalImageUrl = rehostedImageUrl ? await composeEventImage(supabaseUrl, serviceKey, rehostedImageUrl, extracted.title) : null;
    const response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/generate-blog-post-v2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId,
          eventName: extracted.title,
          title: extracted.title,
          eventDate: extracted.date,
          eventTime: extracted.time ?? "",
          venue: extracted.venue ?? "",
          address: extracted.address ?? "",
          locationCity: extracted.location_city ?? "",
          locationState: extracted.location_state ?? "",
          lineup: extracted.lineup.join(", "),
          description: extracted.description ?? "",
          ...finalImageUrl ? { eventImageUrl: finalImageUrl } : {},
          generateImage: true,
          publishImmediately: false
        })
      },
      GENERATE_TIMEOUT_MS
    );
    if (!response.ok) {
      console.error(`[scan-event-sources] Gera\xE7\xE3o falhou para draft ${draftId}: HTTP ${response.status}`);
      return;
    }
    const data = await response.json();
    if (!data?.post?.id) {
      console.error(`[scan-event-sources] Gera\xE7\xE3o sem post.id para draft ${draftId}:`, data);
      return;
    }
    const { error: updateError } = await admin.from("event_watch_drafts").update({ status: "published", published_blog_post_id: data.post.id }).eq("id", draftId);
    if (updateError) {
      console.error(`[scan-event-sources] Falha ao atualizar draft ${draftId} ap\xF3s gera\xE7\xE3o:`, updateError);
    }
    if (autoPublish) {
      const { error: publishError } = await admin.from("blog_posts").update({ published: true, published_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", data.post.id);
      if (publishError) {
        console.error(`[scan-event-sources] Falha ao auto-publicar post ${data.post.id}:`, publishError);
      }
    }
  } catch (error) {
    console.error(`[scan-event-sources] Erro gerando artigo para draft ${draftId}:`, error);
  }
}
Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const admin = createClient2(supabaseUrl, serviceKey);
    const auth = await authorizeAdminOrCron(req, admin, {
      anonKey,
      cronSecretRowName: "scan_event_sources_cron",
      cronJobHeaderValue: "scan-event-sources-cron"
    });
    if (!auth.authorized) return jsonError(auth.message ?? "N\xE3o autorizado", auth.status);
    if (!firecrawlKey) return jsonError("FIRECRAWL_API_KEY n\xE3o configurada", 500);
    if (!lovableKey) return jsonError("LOVABLE_API_KEY n\xE3o configurada", 500);
    const { data: scrapedTemplate } = await admin.from("ai_prompt_templates").select("id").eq("name", "Raspagem de Eventos").maybeSingle();
    const scrapedTemplateId = scrapedTemplate?.id ?? null;
    const { data: autoPublishSetting } = await admin.from("site_settings").select("value").eq("key", "event_watcher_auto_publish").maybeSingle();
    const autoPublish = autoPublishSetting?.value === "true";
    const { data: sources, error: sourcesError } = await admin.from("event_sources").select("id, name, url, type").eq("enabled", true);
    if (sourcesError) throw sourcesError;
    const apifyApiKey = Deno.env.get("APIFY_API_TOKEN")?.trim()?.replace(/^["']|["']$/g, "")?.replace(/[^\x20-\x7E]/g, "");
    const { data: apifyWebhookSecretRow } = await admin.from("internal_cron_secrets").select("secret").eq("name", "apify_instagram_webhook").maybeSingle();
    const apifyWebhookSecret = apifyWebhookSecretRow?.secret ?? null;
    const { data: existingEvents } = await admin.from("events").select("title, date");
    const { data: existingDrafts } = await admin.from("event_watch_drafts").select("extracted_title, extracted_date").neq("status", "rejected");
    const existing = [
      ...(existingEvents ?? []).map((e) => ({ title: e.title, date: e.date })),
      ...(existingDrafts ?? []).map((d) => ({ title: d.extracted_title, date: d.extracted_date }))
    ];
    let created = 0;
    let skippedDuplicate = 0;
    let skippedNoEvent = 0;
    let scrapeErrors = 0;
    let instagramTriggered = 0;
    let instagramSkipped = 0;
    for (const source of sources ?? []) {
      if (source.type === "instagram") {
        if (!apifyApiKey || !apifyWebhookSecret) {
          instagramSkipped++;
          continue;
        }
        const username = extractInstagramUsername(source.url);
        if (!username) {
          instagramSkipped++;
          continue;
        }
        try {
          const webhookUrl = `${supabaseUrl}/functions/v1/apify-instagram-webhook?source_id=${encodeURIComponent(source.id)}&secret=${encodeURIComponent(apifyWebhookSecret)}`;
          const apifyResponse = await fetchWithTimeout(
            "https://api.apify.com/v2/acts/instaprism~instagram-post-monitor/runs",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apifyApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                usernames: [username],
                webhookUrl,
                includeEngagement: false
              })
            },
            SCRAPE_TIMEOUT_MS
          );
          if (!apifyResponse.ok) {
            instagramSkipped++;
            continue;
          }
          instagramTriggered++;
          await admin.from("event_sources").update({ last_scanned_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", source.id);
        } catch (apifyError) {
          console.error(`scan-event-sources: falha ao disparar Apify pra fonte ${source.id}:`, apifyError);
          instagramSkipped++;
        }
        continue;
      }
      const scrape = await scrapeWithFirecrawl(source.url, firecrawlKey, SCRAPE_TIMEOUT_MS);
      if (!scrape.success || !scrape.markdown) {
        scrapeErrors++;
        continue;
      }
      const truncated = scrape.markdown.slice(0, MAX_CONTENT_LENGTH);
      const requestBody = buildExtractionRequest("google/gemini-2.5-flash", source, truncated);
      try {
        const aiResponse = await fetchWithTimeout(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
          },
          AI_TIMEOUT_MS
        );
        if (!aiResponse.ok) {
          scrapeErrors++;
          continue;
        }
        const aiData = await aiResponse.json();
        const extracted = parseExtractionResponse(aiData);
        if (!extracted) {
          skippedNoEvent++;
          continue;
        }
        if (isDuplicateEvent(extracted, existing)) {
          skippedDuplicate++;
          continue;
        }
        const sourcePageUrl = extracted.source_page_url && extracted.source_page_url !== source.url ? extracted.source_page_url : null;
        const { data: insertedDraft, error: insertError } = await admin.from("event_watch_drafts").insert({
          source_id: source.id,
          status: "pending_review",
          extracted_title: extracted.title,
          extracted_date: extracted.date,
          extracted_time: extracted.time,
          extracted_venue: extracted.venue,
          extracted_address: extracted.address,
          extracted_city: extracted.location_city,
          extracted_state: extracted.location_state,
          extracted_lineup: extracted.lineup,
          extracted_ticket_link: extracted.ticket_link,
          extracted_description: extracted.description,
          extracted_confidence: extracted.confidence,
          source_raw_excerpt: truncated.slice(0, 1500),
          source_page_url: sourcePageUrl
        }).select("id").single();
        if (insertError) throw insertError;
        existing.push({ title: extracted.title, date: extracted.date });
        created++;
        EdgeRuntime.waitUntil(
          generateDraftArticle(admin, supabaseUrl, serviceKey, insertedDraft.id, extracted, scrapedTemplateId, autoPublish)
        );
        await admin.from("event_sources").update({ last_scanned_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", source.id);
      } catch (perSourceError) {
        console.error(
          `scan-event-sources: failed processing source ${source.id} (${source.url}):`,
          perSourceError
        );
        scrapeErrors++;
        continue;
      }
    }
    return jsonSuccess({
      success: true,
      sourcesScanned: (sources ?? []).length,
      created,
      skippedDuplicate,
      skippedNoEvent,
      scrapeErrors,
      instagramTriggered,
      instagramSkipped
    });
  } catch (error) {
    return handleError(error, "scan-event-sources");
  }
});
