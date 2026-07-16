// supabase/functions/scan-event-sources/index.ts
//
// DEPLOY NOTE (17/07/2026): esta estrutura multi-arquivo (dedupe.ts/extract.ts
// locais + ../_shared/index.ts) é a correta para desenvolvimento local, lint e
// testes (dedupe_test.ts/extract_test.ts importam essas funções como módulos
// puros testáveis). PORÉM: ao fazer deploy via mcp__supabase-mdaccula__deploy_edge_function,
// esse tool falha com BOOT_ERROR sempre que o arquivo contém uma chamada real a
// `EdgeRuntime.waitUntil(...)` E o deploy é multi-arquivo (não importa se os
// arquivos extras são same-dir "./x.ts" ou "../_shared/x.ts") — confirmado por
// bissecção extensa. A única combinação que funciona é um único arquivo com
// TUDO inlinado (dedupe.ts + extract.ts + as funções de _shared usadas), sem
// nenhum import relativo. Antes de rodar esse deploy tool para esta função,
// construa manualmente essa versão inlinada a partir deste arquivo + dedupe.ts
// + extract.ts + _shared/index.ts. Funções puras continuam vivendo nos arquivos
// separados abaixo — só o payload de deploy precisa ser combinado à mão.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  handleCorsPreFlight,
  jsonSuccess,
  jsonError,
  handleError,
  fetchWithTimeout,
  scrapeWithFirecrawl,
  authorizeAdminOrCron,
} from "../_shared/index.ts";
import { isDuplicateEvent } from "./dedupe.ts";
import { buildExtractionRequest, parseExtractionResponse, type ExtractedEvent } from "./extract.ts";

const SCRAPE_TIMEOUT_MS = 10000;
const AI_TIMEOUT_MS = 60000;
const MAX_CONTENT_LENGTH = 4000;
const GENERATE_TIMEOUT_MS = 120000;
const IMAGE_FETCH_TIMEOUT_MS = 10000;

// Baixa uma imagem real encontrada na página raspada e re-hospeda no Bunny (nunca
// hotlink direto pro CDN de terceiros — evita quebrar se a fonte remover/mover o
// arquivo, e não consome banda do site original). Reaproveita o mesmo pipeline de
// decode/resize/encode WebP usado em generate-blog-post-v2's generateAndAttachImage.
// Qualquer falha (download, decode, upload) retorna null silenciosamente — o caller
// cai no fallback de geração de imagem por IA que já existe, sem regressão possível.
async function rehostImageToBunny(imageUrl: string): Promise<string | null> {
  try {
    const bunnyKey = Deno.env
      .get("BUNNY_STORAGE_API_KEY")
      ?.trim()
      ?.replace(/^["']|["']$/g, "")
      ?.replace(/[^\x20-\x7E]/g, "");
    if (!bunnyKey) return null;

    const imgResp = await fetchWithTimeout(imageUrl, {}, IMAGE_FETCH_TIMEOUT_MS);
    if (!imgResp.ok) return null;

    const rawBuffer = new Uint8Array(await imgResp.arrayBuffer());
    // Buffer minúsculo é quase sempre ícone/pixel de rastreamento, não um flyer real.
    if (rawBuffer.length < 2048) return null;

    let finalBuffer: Uint8Array;
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
      body: finalBuffer,
    });
    if (!uploadResp.ok) return null;

    return `https://mdaccula.b-cdn.net/event-images/${fileName}`;
  } catch (error) {
    console.error("[scan-event-sources] rehostImageToBunny falhou:", error);
    return null;
  }
}

// Dispara a geração do artigo (modo rascunho) pro rascunho recém-extraído, em
// background — não bloqueia a resposta principal do scan, que pode ter achado
// vários eventos novos no mesmo run (cada geração leva até ~140s).
async function generateDraftArticle(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  draftId: string,
  extracted: ExtractedEvent,
  templateId: string | null,
  autoPublish: boolean,
): Promise<void> {
  try {
    // Se a extração achou uma imagem real do evento (flyer/cartaz), tenta re-hospedar
    // no Bunny antes de gerar o artigo. Se falhar por qualquer motivo, segue sem
    // eventImageUrl — generate-blog-post-v2 cai no fallback de geração por IA
    // (generateImage:true) automaticamente, sem nenhuma mudança necessária lá.
    const rehostedImageUrl = extracted.image_url ? await rehostImageToBunny(extracted.image_url) : null;

    // NUNCA envia ticket_link: é sempre o link da página raspada de terceiros (ex:
    // um concorrente), nunca um link oficial da MDAccula. Enviá-lo faria o gerador
    // promover o checkout de outra marca sob o nome da MDAccula (bug de segurança de
    // marca corrigido em 17/07/2026 — ver docs/superpowers/plans do dia).
    const response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/generate-blog-post-v2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
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
          ...(rehostedImageUrl ? { eventImageUrl: rehostedImageUrl } : {}),
          generateImage: true,
          publishImmediately: false,
        }),
      },
      GENERATE_TIMEOUT_MS,
    );

    if (!response.ok) {
      console.error(`[scan-event-sources] Geração falhou para draft ${draftId}: HTTP ${response.status}`);
      return;
    }

    const data = await response.json();
    if (!data?.post?.id) {
      console.error(`[scan-event-sources] Geração sem post.id para draft ${draftId}:`, data);
      return;
    }

    const { error: updateError } = await admin
      .from("event_watch_drafts")
      .update({ status: "published", published_blog_post_id: data.post.id })
      .eq("id", draftId);

    if (updateError) {
      console.error(`[scan-event-sources] Falha ao atualizar draft ${draftId} após geração:`, updateError);
    }

    // Publicação automática (opt-in, site_settings.event_watcher_auto_publish) — pula
    // a revisão manual em /admin/blog. Post nasce sempre como rascunho (published:false)
    // em generate-blog-post-v2; este update extra é o único jeito de ir ao ar sem alguém
    // clicar "Publicar".
    if (autoPublish) {
      const { error: publishError } = await admin
        .from("blog_posts")
        .update({ published: true, published_at: new Date().toISOString() })
        .eq("id", data.post.id);

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const admin = createClient(supabaseUrl, serviceKey);

    const auth = await authorizeAdminOrCron(req, admin, {
      anonKey,
      cronSecretRowName: "scan_event_sources_cron",
      cronJobHeaderValue: "scan-event-sources-cron",
    });
    if (!auth.authorized) return jsonError(auth.message ?? "Não autorizado", auth.status);

    if (!firecrawlKey) return jsonError("FIRECRAWL_API_KEY não configurada", 500);
    if (!lovableKey) return jsonError("LOVABLE_API_KEY não configurada", 500);

    // Template dedicado pra artigos raspados — nunca cita a fonte nem promove links/
    // cupom de terceiros. Buscado por nome (não hardcoded) pra sobreviver a uma
    // recriação do registro. "Evento Padrão" (is_default) fica reservado só pros
    // eventos cadastrados manualmente pelo próprio site.
    const { data: scrapedTemplate } = await admin
      .from("ai_prompt_templates")
      .select("id")
      .eq("name", "Raspagem de Eventos")
      .maybeSingle();
    const scrapedTemplateId = scrapedTemplate?.id ?? null;

    const { data: autoPublishSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "event_watcher_auto_publish")
      .maybeSingle();
    const autoPublish = autoPublishSetting?.value === "true";

    const { data: sources, error: sourcesError } = await admin
      .from("event_sources")
      .select("id, name, url")
      .eq("type", "site")
      .eq("enabled", true);
    if (sourcesError) throw sourcesError;

    const { data: existingEvents } = await admin.from("events").select("title, date");
    const { data: existingDrafts } = await admin
      .from("event_watch_drafts")
      .select("extracted_title, extracted_date")
      .neq("status", "rejected");

    const existing = [
      ...(existingEvents ?? []).map((e) => ({ title: e.title, date: e.date })),
      ...(existingDrafts ?? []).map((d) => ({ title: d.extracted_title, date: d.extracted_date })),
    ];

    let created = 0;
    let skippedDuplicate = 0;
    let skippedNoEvent = 0;
    let scrapeErrors = 0;

    for (const source of sources ?? []) {
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
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
          AI_TIMEOUT_MS,
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

        // Defesa extra: se a IA de extração ignorou a instrução e devolveu a própria
        // URL raiz da fonte como "página específica", trata como se não tivesse
        // encontrado link específico nenhum.
        const sourcePageUrl =
          extracted.source_page_url && extracted.source_page_url !== source.url
            ? extracted.source_page_url
            : null;

        const { data: insertedDraft, error: insertError } = await admin
          .from("event_watch_drafts")
          .insert({
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
            source_page_url: sourcePageUrl,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        existing.push({ title: extracted.title, date: extracted.date });
        created++;

        // Gera o artigo (modo rascunho) em background — não bloqueia o loop de
        // scan, que pode processar várias fontes/eventos no mesmo run.
        // @ts-ignore — EdgeRuntime existe no runtime do Supabase
        EdgeRuntime.waitUntil(
          generateDraftArticle(admin, supabaseUrl, serviceKey, insertedDraft.id, extracted, scrapedTemplateId, autoPublish),
        );

        await admin
          .from("event_sources")
          .update({ last_scanned_at: new Date().toISOString() })
          .eq("id", source.id);
      } catch (perSourceError) {
        console.error(
          `scan-event-sources: failed processing source ${source.id} (${source.url}):`,
          perSourceError,
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
    });
  } catch (error) {
    return handleError(error, "scan-event-sources");
  }
});
