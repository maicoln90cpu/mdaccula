// supabase/functions/scan-event-sources/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

// Dispara a geração do artigo (modo rascunho) pro rascunho recém-extraído, em
// background — não bloqueia a resposta principal do scan, que pode ter achado
// vários eventos novos no mesmo run (cada geração leva até ~140s).
async function generateDraftArticle(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  draftId: string,
  extracted: ExtractedEvent,
): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/generate-blog-post-v2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventName: extracted.title,
          title: extracted.title,
          eventDate: extracted.date,
          eventTime: extracted.time ?? "",
          venue: extracted.venue ?? "",
          address: extracted.address ?? "",
          locationCity: extracted.location_city ?? "",
          locationState: extracted.location_state ?? "",
          lineup: extracted.lineup.join(", "),
          ticketLink: extracted.ticket_link ?? "",
          description: extracted.description ?? "",
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
          generateDraftArticle(admin, supabaseUrl, serviceKey, insertedDraft.id, extracted),
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
