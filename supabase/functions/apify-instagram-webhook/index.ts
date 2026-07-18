// supabase/functions/apify-instagram-webhook/index.ts
//
// Recebe o callback da Apify (ator instaprism/instagram-post-monitor, disparado
// por scan-event-sources) quando encontra post novo numa conta de Instagram
// monitorada. Extrai o evento por IA, compõe a imagem com a marca MDAccula e
// gera o rascunho do artigo — tudo numa única requisição síncrona.
//
// Design deliberado: single-file, sem import de ../_shared/ e sem
// EdgeRuntime.waitUntil — mesmo motivo documentado em scan-event-sources/index.ts
// (BOOT_ERROR em payload multi-arquivo + waitUntil real). Como este webhook é uma
// chamada servidor-a-servidor da própria Apify (não um usuário esperando resposta
// instantânea no navegador), processar tudo de forma síncrona antes de responder
// não é um problema de UX — só evita esse bug de deploy por completo.
//
// A Apify não manda JWT do Supabase — a única proteção é o secret embutido na
// query string da webhookUrl (ver scan-event-sources, tabela internal_cron_secrets,
// linha 'apify_instagram_webhook'), validado ANTES de qualquer outro processamento.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return null;
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const AI_TIMEOUT_MS = 60000;
const IMAGE_FETCH_TIMEOUT_MS = 10000;
const COMPOSE_IMAGE_TIMEOUT_MS = 30000;
const GENERATE_TIMEOUT_MS = 120000;

interface ExtractedEvent {
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  address: string | null;
  location_city: string | null;
  location_state: string | null;
  lineup: string[];
  ticket_link: string | null;
  description: string | null;
  confidence: "high" | "medium" | "low";
}

// Prompt dedicado pra legenda de Instagram — não é markdown de site, então não
// tem instrução de link/imagem em ![alt](url) (a imagem já vem da própria mídia
// do post via Apify, não precisa ser "achada" pela IA).
const EXTRACTION_SYSTEM_PROMPT = `Você é um assistente que extrai dados estruturados de anúncios de eventos de música eletrônica a partir da legenda de um post de Instagram.

Regras:
- Extraia apenas informações EXPLICITAMENTE presentes na legenda. NUNCA invente data, local, horário ou lineup.
- Se a legenda não anuncia nenhum evento (ex: post de bastidor, repost genérico, sem data/local nenhum), retorne has_event=false.
- Se um campo não está claro, deixe-o nulo/vazio — nunca adivinhe.
- confidence="high" só quando data, local e nome do evento estão todos claramente presentes; "medium" quando falta 1 desses; "low" caso contrário.
- No campo "description", NUNCA inclua o nome da conta/perfil de onde este post foi extraído — extraia só o fato sobre o evento em si.`;

function buildExtractionRequest(modelName: string, caption: string): Record<string, unknown> {
  return {
    model: modelName,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: `Legenda do post:\n${caption}\n\nExtraia os dados do evento anunciado, se houver algum.` },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_event",
          description: "Extrai dados estruturados de um evento de música eletrônica anunciado na legenda, se houver",
          parameters: {
            type: "object",
            properties: {
              has_event: { type: "boolean" },
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
            },
            required: ["has_event", "confidence"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_event" } },
  };
}

function parseExtractionResponse(aiData: unknown): ExtractedEvent | null {
  const toolCall = (aiData as any)?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;

  let args: Record<string, unknown>;
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
    lineup: Array.isArray(args.lineup) ? args.lineup.filter((x): x is string => typeof x === "string") : [],
    ticket_link: typeof args.ticket_link === "string" && args.ticket_link ? args.ticket_link : null,
    description: typeof args.description === "string" && args.description ? args.description : null,
    confidence: (["high", "medium", "low"].includes(args.confidence as string) ? args.confidence : "low") as "high" | "medium" | "low",
  };
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDuplicateEvent(
  candidate: { title: string; date: string },
  existing: { title: string; date: string }[],
): boolean {
  const normalizedCandidate = normalizeTitle(candidate.title);
  return existing.some((e) => e.date === candidate.date && normalizeTitle(e.title) === normalizedCandidate);
}

// Mesmo pipeline decode/resize/encode de scan-event-sources' rehostImageToBunny —
// nunca hotlink direto pro CDN do Instagram (pode expirar/bloquear hotlink).
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
    if (rawBuffer.length < 2048) return null;

    const fileName = `event-instagram-${Date.now()}.jpg`;
    const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
    const uploadResp = await fetch(`https://${bunnyHostname}/mdaccula/event-images/${fileName}`, {
      method: "PUT",
      headers: { AccessKey: bunnyKey, "Content-Type": "image/jpeg" },
      body: rawBuffer,
    });
    if (!uploadResp.ok) return null;

    return `https://mdaccula.b-cdn.net/event-images/${fileName}`;
  } catch (error) {
    console.error("[apify-instagram-webhook] rehostImageToBunny falhou:", error);
    return null;
  }
}

async function composeEventImage(
  supabaseUrl: string,
  serviceKey: string,
  imageUrl: string,
  title: string,
): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/compose-event-image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl, title }),
      },
      COMPOSE_IMAGE_TIMEOUT_MS,
    );
    if (!response.ok) return imageUrl;
    const data = await response.json();
    return typeof data?.imageUrl === "string" ? data.imageUrl : imageUrl;
  } catch (error) {
    console.error("[apify-instagram-webhook] composeEventImage falhou, usando imagem sem marca:", error);
    return imageUrl;
  }
}

// Parse defensivo do payload da Apify — formato exato ainda não confirmado numa
// chamada real (ver log do corpo bruto abaixo). Aceita tanto o formato "resumo do
// run" (newPosts[]) quanto um objeto de post único solto no corpo.
interface ApifyPost {
  owner?: string;
  postId?: string;
  shortcode?: string;
  url?: string;
  caption?: string;
  mediaType?: string;
  thumbnailUrl?: string;
}

function extractFirstPost(body: unknown): ApifyPost | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.newPosts) && obj.newPosts.length > 0) {
    return obj.newPosts[0] as ApifyPost;
  }
  if (typeof obj.caption === "string" || typeof obj.url === "string") {
    return obj as ApifyPost;
  }
  return null;
}

async function logRawPayload(
  admin: ReturnType<typeof createClient>,
  sourceId: string | null,
  rawBody: string,
): Promise<void> {
  try {
    await admin.from("application_logs").insert({
      level: "info",
      message: "apify-instagram-webhook raw payload",
      context: { sourceId, rawBody: rawBody.slice(0, 20000) },
    });
  } catch (error) {
    console.error("[apify-instagram-webhook] Falha ao logar payload bruto:", error);
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const sourceId = url.searchParams.get("source_id");
  const secret = url.searchParams.get("secret");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  // Validação do secret ANTES de qualquer outro processamento — a Apify não
  // manda JWT do Supabase, então isso é a única defesa contra chamadas forjadas.
  const { data: secretRow } = await admin
    .from("internal_cron_secrets")
    .select("secret")
    .eq("name", "apify_instagram_webhook")
    .maybeSingle();
  if (!sourceId || !secret || !secretRow?.secret || secretRow.secret !== secret) {
    return jsonResponse({ error: "Não autorizado", success: false }, 401);
  }

  const rawBody = await req.text();
  // Log do corpo bruto ANTES do parse — é assim que o formato real do payload da
  // Apify vai ser confirmado na primeira chamada de verdade (ver DEPLOY NOTE no
  // topo do arquivo). Sempre acontece, mesmo que o parse abaixo falhe depois.
  await logRawPayload(admin, sourceId, rawBody);

  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Corpo não é JSON válido — não é um erro fatal do nosso lado, só não há
    // nada pra processar. Responde 200 pra Apify não ficar re-tentando à toa.
    return jsonResponse({ success: true, processed: false, reason: "invalid_json" });
  }

  const post = extractFirstPost(body);
  if (!post) {
    return jsonResponse({ success: true, processed: false, reason: "no_post_in_payload" });
  }

  if (!lovableKey) {
    console.error("[apify-instagram-webhook] LOVABLE_API_KEY não configurada");
    return jsonResponse({ success: true, processed: false, reason: "missing_ai_key" });
  }

  try {
    const postIdentifier = post.postId ?? post.shortcode ?? post.url ?? null;

    // Dedup contra o último post já visto dessa fonte (event_sources.last_seen_post_id).
    if (postIdentifier) {
      const { data: sourceRow } = await admin
        .from("event_sources")
        .select("last_seen_post_id")
        .eq("id", sourceId)
        .maybeSingle();
      if (sourceRow?.last_seen_post_id && sourceRow.last_seen_post_id === postIdentifier) {
        return jsonResponse({ success: true, processed: false, reason: "already_seen" });
      }
    }

    const caption = post.caption ?? "";
    if (!caption.trim()) {
      return jsonResponse({ success: true, processed: false, reason: "empty_caption" });
    }

    const aiResponse = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildExtractionRequest("google/gemini-2.5-flash", caption)),
      },
      AI_TIMEOUT_MS,
    );

    if (!aiResponse.ok) {
      return jsonResponse({ success: true, processed: false, reason: "ai_extraction_failed" });
    }

    const aiData = await aiResponse.json();
    const extracted = parseExtractionResponse(aiData);
    if (!extracted) {
      return jsonResponse({ success: true, processed: false, reason: "no_event_in_caption" });
    }

    const { data: existingEvents } = await admin.from("events").select("title, date");
    const { data: existingDrafts } = await admin
      .from("event_watch_drafts")
      .select("extracted_title, extracted_date")
      .neq("status", "rejected");
    const existing = [
      ...(existingEvents ?? []).map((e) => ({ title: e.title, date: e.date })),
      ...(existingDrafts ?? []).map((d) => ({ title: d.extracted_title, date: d.extracted_date })),
    ];
    if (isDuplicateEvent(extracted, existing)) {
      return jsonResponse({ success: true, processed: false, reason: "duplicate_event" });
    }

    // Imagem: rehost + composição com a marca MDAccula, mesmo padrão do fluxo de
    // sites. Se não houver thumbnailUrl, segue sem imagem — generate-blog-post-v2
    // cai no fallback de geração por IA automaticamente.
    let finalImageUrl: string | null = null;
    if (post.thumbnailUrl) {
      const rehosted = await rehostImageToBunny(post.thumbnailUrl);
      finalImageUrl = rehosted ? await composeEventImage(supabaseUrl, serviceKey, rehosted, extracted.title) : null;
    }

    const { data: scrapedTemplate } = await admin
      .from("ai_prompt_templates")
      .select("id")
      .eq("name", "Raspagem de Eventos")
      .maybeSingle();

    const { data: insertedDraft, error: insertError } = await admin
      .from("event_watch_drafts")
      .insert({
        source_id: sourceId,
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
        source_raw_excerpt: caption.slice(0, 1500),
        source_page_url: post.url ?? null,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const { data: autoPublishSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "event_watcher_auto_publish")
      .maybeSingle();
    const autoPublish = autoPublishSetting?.value === "true";

    // Geração SÍNCRONA (sem EdgeRuntime.waitUntil) — decisão deliberada pra não
    // correr risco do bug de deploy documentado (ver comentário no topo do
    // arquivo). A Apify tolera uma resposta mais lenta aqui, é uma chamada de
    // callback servidor-a-servidor, não um usuário esperando no navegador.
    // NUNCA envia ticket_link — mesma regra de segurança de marca do fluxo de sites.
    const generateResponse = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/generate-blog-post-v2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: scrapedTemplate?.id ?? null,
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
          ...(finalImageUrl ? { eventImageUrl: finalImageUrl } : {}),
          generateImage: true,
          publishImmediately: false,
        }),
      },
      GENERATE_TIMEOUT_MS,
    );

    let publishedBlogPostId: string | null = null;
    if (generateResponse.ok) {
      const generateData = await generateResponse.json();
      if (generateData?.post?.id) {
        publishedBlogPostId = generateData.post.id;
        await admin
          .from("event_watch_drafts")
          .update({ status: "published", published_blog_post_id: publishedBlogPostId })
          .eq("id", insertedDraft.id);

        if (autoPublish) {
          await admin
            .from("blog_posts")
            .update({ published: true, published_at: new Date().toISOString() })
            .eq("id", publishedBlogPostId);
        }
      }
    } else {
      console.error(`[apify-instagram-webhook] Geração falhou para draft ${insertedDraft.id}: HTTP ${generateResponse.status}`);
    }

    await admin
      .from("event_sources")
      .update({
        last_scanned_at: new Date().toISOString(),
        ...(postIdentifier ? { last_seen_post_id: postIdentifier } : {}),
      })
      .eq("id", sourceId);

    return jsonResponse({
      success: true,
      processed: true,
      draftId: insertedDraft.id,
      publishedBlogPostId,
    });
  } catch (error) {
    console.error("[apify-instagram-webhook] Erro processando post:", error);
    // Sempre 200 pra Apify não reenviar em loop um payload que já causou erro.
    return jsonResponse({ success: true, processed: false, reason: "internal_error" });
  }
});
