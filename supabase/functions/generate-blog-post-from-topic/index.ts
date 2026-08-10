// supabase/functions/generate-blog-post-from-topic/index.ts
import { createClient as createClient2 } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/titleSanitizer.ts
var EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F900}-\u{1F9FF}\uFE0F\u200D]/gu;
var BAD_PREFIXES = [
  /^confira[:\s]+/i,
  /^não perca[:\s]+/i,
  /^nao perca[:\s]+/i,
  /^imperdível[:\s]+/i,
  /^imperdivel[:\s]+/i,
  /^veja[:\s]+/i
];
var DATE_LITERAL_REGEX = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;
function sanitizeTitle(raw) {
  let out = (raw ?? "").replace(EMOJI_REGEX, "").trim();
  for (const prefix of BAD_PREFIXES) {
    out = out.replace(prefix, "").trim();
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
function validateTitle(raw) {
  const cleaned = sanitizeTitle(raw);
  const issues = [];
  if (EMOJI_REGEX.test(raw)) issues.push("cont\xE9m emoji");
  if (raw.includes("|")) issues.push("cont\xE9m separador '|'");
  if (raw.includes(" \u2014 ") || raw.includes(" \u2013 ")) issues.push("cont\xE9m separador ' \u2014 '");
  if (DATE_LITERAL_REGEX.test(raw)) issues.push("cont\xE9m data literal DD/MM");
  if (cleaned.length < 30) issues.push("muito curto (<30 chars)");
  if (cleaned.length > 100) issues.push("muito longo (>100 chars)");
  return { valid: issues.length === 0, issues, cleaned };
}

// supabase/functions/_shared/editorialQuality.ts
var EDITORIAL_QUALITY_BLOCK = `

\u{1F4CF} QUALIDADE EDITORIAL (regras absolutas, valem para qualquer se\xE7\xE3o do artigo):

\u{1F6AB} CLICH\xCAS E ENCHIMENTO PROIBIDOS \u2014 nunca use estas express\xF5es (ou varia\xE7\xF5es \xF3bvias delas):
- "experi\xEAncia \xFAnica", "noite inesquec\xEDvel", "algo m\xE1gico", "vibrante cena"
- "imperd\xEDvel", "sensacional", "espetacular" sem um fato espec\xEDfico logo ao lado
- "quando se trata de", "sem d\xFAvida", "\xE9 importante ressaltar que"
- "Al\xE9m disso" ou "Vale destacar" como abertura de frase (varie a transi\xE7\xE3o ou remova)
- "Prepare-se para" ou "Get ready" como abertura de artigo ou de se\xE7\xE3o
- Qualquer adjetivo de intensidade (incr\xEDvel, \xE9pico, surreal, brutal) usado sem um dado concreto que o sustente na mesma frase

\u2705 MANDATO DE ESPECIFICIDADE \u2014 toda afirma\xE7\xE3o forte precisa se apoiar em um fato do bloco DADOS OFICIAIS:
- Errado: "Um line-up de peso promete agitar a pista." (adjetivo solto, sem fato)
- Certo: "Com Artista X abrindo a night antes do B2B entre Artista Y e Artista Z, o line-up cobre do progressive ao peak-time techno." (fato \u2192 conclus\xE3o)
- Se n\xE3o houver dado suficiente para sustentar um superlativo, descreva o fato puro e seco \u2014 n\xE3o compense com adjetivo.

\u{1F399}\uFE0F TOM \xDANICO (vale para TODO artigo, evento \xFAnico ou s\xE9rie):
- Informativo e vibrante, registro de revista eletr\xF4nica (Mixmag/DJ Mag/Billboard) \u2014 n\xE3o \xE9 an\xFAncio classificado, n\xE3o \xE9 vendedor de rua.
- PROIBIDO: linguagem de urg\xEAncia artificial ("compre AGORA", "corre que esgota", caixa alta para \xEAnfase), emoji em qualquer parte do artigo (t\xEDtulo, corpo ou CTA de link).
- O CTA de ingresso deve ser direto e claro, mas sem tom de press\xE3o \u2014 descreva o que a pessoa ganha, n\xE3o crie medo de perder.
- \u26A0\uFE0F EXCE\xC7\xC3O \u2014 se as INSTRU\xC7\xD5ES ESPECIAIS DO ADMIN (aiContext) especificarem um tom/voz diferente deste (ex: mais informal, mais direto, frases curtas, "voz de amigo" em vez de "revista"), ESSA instru\xE7\xE3o VENCE o registro descrito acima \u2014 mude o estilo de verdade, n\xE3o apenas o final do texto. As \xFAnicas coisas que continuam valendo sempre, mesmo com tom alternativo: nunca inventar fatos, nunca usar os clich\xEAs da lista abaixo, e nunca usar emoji.

\u270D\uFE0F ABERTURA DO ARTIGO:
- N\xE3o abra com frase gen\xE9rica de clima/expectativa ("Prepare-se para uma noite incr\xEDvel"). Abra com um fato concreto e espec\xEDfico: o motivo real da mat\xE9ria \u2014 um retorno, uma estreia, um B2B raro, a escala da produ\xE7\xE3o, o motivo do line-up ser not\xE1vel.

\u{1F6AB} NUNCA ECOE R\xD3TULOS DOS BLOCOS DE DADOS \u2014 os blocos "DADOS OFICIAIS", "PROGRAMA\xC7\xC3O" etc. s\xE3o s\xF3 para voc\xEA LER os fatos, nunca para copiar o formato "R\xF3tulo: valor" para o texto do artigo:
- Errado: "Casa/Venue: S\xE3o Paulo (cidade: S\xE3o Paulo, estado: SP)." \u2014 copiou o r\xF3tulo literalmente.
- Certo: "O evento acontece em S\xE3o Paulo." \u2014 usou o fato, sem repetir o r\xF3tulo nem a cidade duas vezes.
- Isso vale para qualquer r\xF3tulo do bloco (Casa/Venue:, Cidade:, Estado:, Data:, Hor\xE1rio de in\xEDcio:, Link VIP/camarote: etc.) \u2014 converta SEMPRE em prosa natural, nunca em pares "campo: valor".
- Se dois dados do bloco forem id\xEAnticos (ex: venue e cidade s\xE3o a mesma string), mencione o local UMA vez s\xF3 \u2014 n\xE3o repita a mesma informa\xE7\xE3o com r\xF3tulos diferentes.
`;

// supabase/functions/_shared/firecrawlSearch.ts
var MAX_CONTENT_LENGTH = 2e3;
var BLOCKED_HOSTNAMES = [
  "youtube.com",
  "youtu.be",
  "spotify.com",
  "music.apple.com",
  "soundcloud.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "wikipedia.org",
  "wikimedia.org",
  "wikiwand.com",
  "imdb.com",
  "themoviedb.org",
  "rottentomatoes.com",
  "letterboxd.com",
  "fandom.com",
  "mdaccula.com",
  "mdaccula.b-cdn.net"
];
function isBlockedSource(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_HOSTNAMES.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
async function searchWithFirecrawl(query, apiKey, limit, timeoutMs = 3e4) {
  const response = await fetchWithTimeout("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true }
    })
  }, timeoutMs);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl search HTTP ${response.status}: ${errorText.substring(0, 200)}`);
  }
  const data = await response.json();
  const rawResults = Array.isArray(data?.data?.web) ? data.data.web : Array.isArray(data?.data) ? data.data : [];
  const results = [];
  for (const item of rawResults) {
    const r = item;
    const markdown = typeof r.markdown === "string" ? r.markdown : "";
    const metadata = r.metadata || {};
    const url = typeof r.url === "string" && r.url || typeof metadata.sourceURL === "string" && metadata.sourceURL || "";
    const title = typeof r.title === "string" && r.title || typeof metadata.title === "string" && metadata.title || url;
    if (markdown && url && !isBlockedSource(url)) {
      results.push({ title: String(title), url: String(url), content: markdown.substring(0, MAX_CONTENT_LENGTH) });
    }
  }
  return results;
}

// supabase/functions/_shared/sourceArticlePicker.ts
async function fetchWithTimeout2(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
var ARTICLE_CONTENT_MAX_LENGTH = 8e3;
async function scrapeArticleContent(articleUrl, apiKey, timeoutMs = 15e3) {
  const response = await fetchWithTimeout2(
    "https://api.firecrawl.dev/v1/scrape",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: articleUrl, formats: ["markdown"], onlyMainContent: true, waitFor: 1500 })
    },
    timeoutMs
  );
  if (!response.ok) return null;
  const data = await response.json();
  const markdown = data?.data?.markdown;
  if (typeof markdown !== "string" || !markdown.trim()) return null;
  return { markdown: markdown.substring(0, ARTICLE_CONTENT_MAX_LENGTH) };
}

// supabase/functions/_shared/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
async function fetchWithTimeout3(url, options, timeoutMs) {
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

// supabase/functions/_shared/bunnyUploadBytes.ts
var BUNNY_STORAGE_ZONE = "mdaccula";
var BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net";
function getBunnyStorageHost() {
  const hostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
  return hostname ? `https://${hostname}` : "https://storage.bunnycdn.com";
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

// supabase/functions/_shared/articleImage.ts
var OG_IMAGE_REGEX = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i;
function extractOgImageFromHtml(html, pageUrl) {
  const match = html.match(OG_IMAGE_REGEX);
  if (!match) return null;
  let imageUrl = match[1];
  if (!imageUrl.startsWith("http")) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).toString();
    } catch {
      return null;
    }
  }
  return imageUrl;
}
async function fetchOriginalArticleImage(articleUrl, timeoutMs = 8e3) {
  try {
    const response = await fetchWithTimeout3(
      articleUrl,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; MDAcculaBot/1.0)" }, redirect: "follow" },
      timeoutMs
    );
    if (!response.ok) return null;
    const html = await response.text();
    return extractOgImageFromHtml(html, response.url || articleUrl);
  } catch {
    return null;
  }
}
function parseFirecrawlImageResults(data) {
  const images = data?.data;
  const rawImages = images?.images;
  if (!Array.isArray(rawImages)) return [];
  const results = [];
  for (const item of rawImages) {
    const r = item;
    const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl : "";
    if (!imageUrl) continue;
    results.push({
      imageUrl,
      title: typeof r.title === "string" ? r.title : "",
      pageUrl: typeof r.url === "string" ? r.url : ""
    });
  }
  return results;
}
async function searchImageWithFirecrawl(query, apiKey, timeoutMs = 15e3) {
  try {
    const response = await fetchWithTimeout3(
      "https://api.firecrawl.dev/v1/search",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources: ["images"], limit: 3 })
      },
      timeoutMs
    );
    if (!response.ok) return null;
    const data = await response.json();
    const results = parseFirecrawlImageResults(data);
    return results[0] || null;
  } catch {
    return null;
  }
}
var EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};
async function downloadAndRehostImage(imageUrl, pathPrefix, timeoutMs = 15e3) {
  try {
    const response = await fetchWithTimeout3(
      imageUrl,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; MDAcculaBot/1.0)" } },
      timeoutMs
    );
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
    const ext = EXTENSION_BY_CONTENT_TYPE[contentType] || "jpg";
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return null;
    const fileName = `${pathPrefix}-${Date.now()}.${ext}`;
    const { url } = await uploadBytesToBunny(buffer, `event-images/${fileName}`, contentType);
    return url;
  } catch {
    return null;
  }
}
function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function deriveSearchTermFromUrl(url) {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const lastSegment = segments[segments.length - 1];
    const words = lastSegment.replace(/[-_]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    return words.slice(0, 10).join(" ");
  } catch {
    return null;
  }
}
async function resolveArticleImage(articleUrl, sourceName, searchTerm, firecrawlApiKey) {
  const originalImageUrl = await fetchOriginalArticleImage(articleUrl);
  if (originalImageUrl) {
    const rehosted = await downloadAndRehostImage(originalImageUrl, "topic-original");
    if (rehosted) {
      return { url: rehosted, credit: `Imagem: ${sourceName}` };
    }
  }
  const slugTerm = deriveSearchTermFromUrl(articleUrl);
  const searchTerms = [slugTerm, searchTerm].filter(
    (t, i, arr) => !!t && arr.indexOf(t) === i
  );
  for (const term of searchTerms) {
    const searchResult = await searchImageWithFirecrawl(term, firecrawlApiKey);
    if (searchResult) {
      const rehosted = await downloadAndRehostImage(searchResult.imageUrl, "topic-search");
      if (rehosted) {
        const creditSource = extractHostname(searchResult.pageUrl) || searchResult.title || "web";
        return { url: rehosted, credit: `Imagem: ${creditSource}` };
      }
    }
  }
  return null;
}

// supabase/functions/_shared/articleQuality.ts
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
var MIN_ARTICLE_PLAINTEXT_LENGTH = 500;
function isContentSubstantial(html, minLength = MIN_ARTICLE_PLAINTEXT_LENGTH) {
  return stripHtmlTags(html).length >= minLength;
}

// supabase/functions/generate-blog-post-from-topic/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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
var SEARCH_TIMEOUT_MS = 3e4;
var AI_TIMEOUT_MS = 1e5;
var MAX_SOURCES = 5;
async function fetchWithTimeout4(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const startTime = Date.now();
  try {
    const body = await req.json();
    const mode = body?.mode === "source_article" ? "source_article" : "open_search";
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const sourceName = typeof body?.sourceName === "string" ? body.sourceName.trim() : "";
    const generateImage = Boolean(body?.generateImage);
    const publishImmediately = body?.publishImmediately;
    const generationSource = mode === "source_article" ? "auto_cron" : typeof body?.generationSource === "string" ? body.generationSource : null;
    if (mode === "source_article") {
      if (!sourceUrl) {
        return jsonError("Informe sourceUrl (URL da mat\xE9ria a reescrever)", 400);
      }
    } else if (!query) {
      return jsonError('Informe um termo de busca (ex: "Solomun S\xE3o Paulo")', 400);
    }
    const topicLabel = mode === "source_article" ? sourceName || sourceUrl : query;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError("Configura\xE7\xE3o de ambiente incompleta", 500);
    }
    if (!FIRECRAWL_API_KEY) {
      return jsonError("FIRECRAWL_API_KEY n\xE3o configurada \u2014 necess\xE1ria para gerar artigo por busca de tema.", 500);
    }
    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      return jsonError("Nenhuma API key de IA configurada", 500);
    }
    const supabase = createClient2(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let sourceUrls;
    let sourcesBlock;
    if (mode === "source_article") {
      console.log(`[generate-blog-post-from-topic] Raspando mat\xE9ria \xFAnica: ${sourceUrl}`);
      const scraped = await scrapeArticleContent(sourceUrl, FIRECRAWL_API_KEY);
      if (!scraped) {
        return jsonError(`N\xE3o foi poss\xEDvel raspar conte\xFAdo real de "${sourceUrl}". A mat\xE9ria pode ter sido removida ou o scraping falhou.`, 404);
      }
      sourceUrls = [sourceUrl];
      sourcesBlock = `### Mat\xE9ria original (${sourceName || "fonte cadastrada"}, ${sourceUrl})
${scraped.markdown}`;
    } else {
      console.log(`[generate-blog-post-from-topic] Buscando fontes para: "${query}"`);
      let searchResults = [];
      try {
        searchResults = await searchWithFirecrawl(query, FIRECRAWL_API_KEY, MAX_SOURCES, SEARCH_TIMEOUT_MS);
      } catch (searchError) {
        console.error("[generate-blog-post-from-topic] Erro na busca Firecrawl:", searchError);
        return jsonError("Falha ao buscar fontes para esse termo. Tente novamente em instantes.", 502);
      }
      if (searchResults.length === 0) {
        return jsonError(`Nenhuma fonte encontrada para "${query}". Tente um termo mais espec\xEDfico ou mais popular.`, 404);
      }
      console.log(`[generate-blog-post-from-topic] ${searchResults.length} fontes raspadas com sucesso`);
      sourceUrls = searchResults.map((r) => r.url);
      sourcesBlock = searchResults.map((r, i) => `### Fonte ${i + 1}: ${r.title} (${r.url})
${r.content}`).join("\n\n---\n\n");
    }
    const { data: settings } = await supabase.from("site_settings").select("key, value").in("key", ["ai_blog_model", "ai_temperature"]);
    const settingsMap = {};
    settings?.forEach((s) => {
      settingsMap[s.key] = s.value || "";
    });
    const selectedModel = settingsMap["ai_blog_model"] || "google/gemini-2.5-flash";
    const temperature = parseFloat(settingsMap["ai_temperature"] || "0.9");
    const systemPrompt = mode === "source_article" ? `Voc\xEA \xE9 um jornalista especializado em m\xFAsica eletr\xF4nica, escrevendo para um blog moderno inspirado em ve\xEDculos como Mixmag, DJ Mag, Billboard e Electronic Groove.

Voc\xEA recebeu o conte\xFAdo de UMA mat\xE9ria real, espec\xEDfica, publicada por "${sourceName || "uma fonte parceira"}". Sua tarefa \xE9 REESCREVER essa mat\xE9ria no registro editorial do nosso blog \u2014 n\xE3o \xE9 uma s\xEDntese de v\xE1rias fontes, \xE9 a adapta\xE7\xE3o fiel de UMA mat\xE9ria s\xF3.

\u{1F6A8} REGRA CR\xCDTICA \u2014 IDIOMA:
O artigo final \xE9 SEMPRE em portugu\xEAs do Brasil, mesmo que a mat\xE9ria original esteja em outro idioma (ingl\xEAs, espanhol etc.). Traduza e adapte todo o conte\xFAdo pra PT-BR \u2014 nunca deixe par\xE1grafos inteiros em outro idioma. Nomes pr\xF3prios, t\xEDtulos de faixas/\xE1lbuns/eventos e cita\xE7\xF5es diretas podem permanecer no idioma original, mas o texto ao redor (frases, explica\xE7\xF5es, narrativa) \xE9 sempre em portugu\xEAs.

\u{1F6A8} REGRA CR\xCDTICA \u2014 FIDELIDADE ABSOLUTA \xC0 MAT\xC9RIA ORIGINAL:
- Use APENAS fatos, cita\xE7\xF5es e dados que aparecem na mat\xE9ria original abaixo.
- NUNCA invente datas, nomes, n\xFAmeros ou eventos que n\xE3o estejam nela.
- N\xC3O adicione contexto de fora, n\xE3o misture com outras not\xEDcias que voc\xEA "sabe" sobre o assunto \u2014 s\xF3 o que est\xE1 na mat\xE9ria original.
- Pode reestruturar a narrativa, o t\xEDtulo e o \xE2ngulo de abertura livremente, mas os fatos t\xEAm que bater 100% com o original.

\u{1F6A8} REGRA CR\xCDTICA \u2014 MAT\xC9RIA ORIGINAL SEM NOT\xCDCIA REAL (p\xE1gina institucional/homepage):
Se o conte\xFAdo abaixo for s\xF3 material institucional \u2014 menu de navega\xE7\xE3o, texto "sobre n\xF3s",
nenhuma not\xEDcia espec\xEDfica com fato concreto (um lan\xE7amento, um evento, uma declara\xE7\xE3o,
um dado) \u2014 N\xC3O escreva um perfil institucional da fonte como se fosse a mat\xE9ria. Isso n\xE3o
\xE9 uma not\xEDcia. Nesse caso, retorne APENAS este JSON e nada mais:
{ "insufficientSources": true, "reason": "explica\xE7\xE3o curta do porqu\xEA a mat\xE9ria n\xE3o \xE9 uma not\xEDcia real" }

ESTRUTURA OBRIGAT\xD3RIA QUANDO HOUVER FATO REAL (retorne APENAS JSON v\xE1lido):
{
  "title": "T\xEDtulo editorial chamativo (50-80 caracteres, sem emoji, sem data literal)",
  "excerpt": "Resumo de 1-2 frases (m\xE1x 200 caracteres)",
  "content": "HTML do artigo completo",
  "category": "uma de: Produtores, Tecnologia, Cultura, Lan\xE7amentos, Festivais, Cena"
}

TAMANHO: proporcional ao volume real de conte\xFAdo da mat\xE9ria original \u2014 n\xE3o estique com
generalidades, adjetivos ou repeti\xE7\xE3o s\xF3 para bater um n\xFAmero de palavras maior do que
a mat\xE9ria original sustenta. MAS "proporcional" nunca significa 1 par\xE1grafo s\xF3: extraia
e desenvolva TODOS os fatos concretos dispon\xEDveis na mat\xE9ria original (contexto, datas,
nomes, n\xFAmeros, declara\xE7\xF5es, repercuss\xE3o, detalhes do line-up/local/hor\xE1rio quando
existirem) antes de considerar o artigo terminado \u2014 um artigo de 1 par\xE1grafo quase
sempre significa que voc\xEA parou cedo demais, n\xE3o que a fonte era realmente curta.

FORMATA\xC7\xC3O HTML: <h2>/<h3> para se\xE7\xF5es, <p> para par\xE1grafos, <strong> para destaques.
RETORNE APENAS O JSON, sem markdown, sem texto adicional.
${EDITORIAL_QUALITY_BLOCK}` : `Voc\xEA \xE9 um jornalista especializado em m\xFAsica eletr\xF4nica, escrevendo para um blog moderno inspirado em ve\xEDculos como Mixmag, DJ Mag, Billboard e Electronic Groove.

Voc\xEA recebeu um conjunto de fontes reais (resultado de uma busca na web) sobre o termo "${query}". Sua tarefa \xE9 escrever um artigo jornal\xEDstico ancorado EXCLUSIVAMENTE nos fatos presentes nessas fontes.

\u{1F6A8} REGRA CR\xCDTICA \u2014 IDIOMA:
O artigo final \xE9 SEMPRE em portugu\xEAs do Brasil, mesmo que as fontes estejam em outro idioma (ingl\xEAs, espanhol etc.). Traduza e adapte todo o conte\xFAdo pra PT-BR \u2014 nunca deixe par\xE1grafos inteiros em outro idioma. Nomes pr\xF3prios, t\xEDtulos de faixas/\xE1lbuns/eventos e cita\xE7\xF5es diretas podem permanecer no idioma original, mas o texto ao redor (frases, explica\xE7\xF5es, narrativa) \xE9 sempre em portugu\xEAs.

\u{1F6A8} REGRA CR\xCDTICA \u2014 FONTES T\xCAM PRIORIDADE ABSOLUTA:
- Use APENAS fatos, cita\xE7\xF5es e dados que aparecem no bloco FONTES ENCONTRADAS abaixo.
- NUNCA invente datas, nomes, n\xFAmeros ou eventos que n\xE3o estejam nas fontes.
- Se as fontes forem insuficientes ou conflitantes sobre algum ponto, omita esse ponto \u2014 n\xE3o especule.
- Cite o contexto das fontes de forma natural no texto (sem citar "Fonte 1" literalmente \u2014 integre a informa\xE7\xE3o como prosa jornal\xEDstica).

\u{1F6A8} REGRA CR\xCDTICA \u2014 FONTES SEM NOT\xCDCIA REAL (p\xE1ginas institucionais/homepage):
Se as fontes abaixo forem s\xF3 a homepage gen\xE9rica de um site/marca/label \u2014 menu de
navega\xE7\xE3o, texto "sobre n\xF3s", nenhuma not\xEDcia espec\xEDfica com fato concreto (um
lan\xE7amento, um evento, uma declara\xE7\xE3o, um dado) \u2014 N\xC3O escreva um perfil institucional
do ve\xEDculo/marca como se fosse a mat\xE9ria. Isso n\xE3o \xE9 uma not\xEDcia. Nesse caso, retorne
APENAS este JSON e nada mais:
{ "insufficientSources": true, "reason": "explica\xE7\xE3o curta do porqu\xEA as fontes n\xE3o sustentam uma not\xEDcia real" }

ESTRUTURA OBRIGAT\xD3RIA QUANDO HOUVER FATO REAL (retorne APENAS JSON v\xE1lido):
{
  "title": "T\xEDtulo editorial chamativo (50-80 caracteres, sem emoji, sem data literal)",
  "excerpt": "Resumo de 1-2 frases (m\xE1x 200 caracteres)",
  "content": "HTML do artigo completo",
  "category": "uma de: Produtores, Tecnologia, Cultura, Lan\xE7amentos, Festivais, Cena"
}

TAMANHO: proporcional ao volume real de fatos dispon\xEDvel nas fontes \u2014 normalmente
entre 500 e 1300 palavras. NUNCA estique o texto com generalidades, adjetivos ou
repeti\xE7\xE3o s\xF3 para bater um n\xFAmero de palavras maior do que as fontes sustentam. MAS
"proporcional" nunca significa 1 par\xE1grafo s\xF3: extraia e desenvolva TODOS os fatos
concretos dispon\xEDveis nas fontes antes de considerar o artigo terminado.

FORMATA\xC7\xC3O HTML: <h2>/<h3> para se\xE7\xF5es, <p> para par\xE1grafos, <strong> para destaques.
RETORNE APENAS O JSON, sem markdown, sem texto adicional.
${EDITORIAL_QUALITY_BLOCK}`;
    const userPrompt = mode === "source_article" ? `Reescreva jornalisticamente a mat\xE9ria abaixo, publicada por "${sourceName || "uma fonte parceira"}", no registro editorial do nosso blog.

MAT\xC9RIA ORIGINAL (use literalmente, NUNCA invente al\xE9m do que est\xE1 aqui, NUNCA misture com outras not\xEDcias):

${sourcesBlock}

Se a mat\xE9ria acima n\xE3o for uma not\xEDcia real (s\xF3 homepage/institucional), retorne
{ "insufficientSources": true, "reason": "..." } conforme o system prompt, em vez de inventar
um perfil da fonte. Caso contr\xE1rio, retorne APENAS o JSON do artigo, com extens\xE3o
proporcional ao conte\xFAdo original.` : `Escreva um artigo jornal\xEDstico completo sobre "${query}", baseado nas fontes abaixo.

FONTES ENCONTRADAS (use literalmente, NUNCA invente al\xE9m do que est\xE1 aqui):

${sourcesBlock}

Se as fontes acima n\xE3o contiverem uma not\xEDcia real (s\xF3 homepage/institucional), retorne
{ "insufficientSources": true, "reason": "..." } conforme o system prompt, em vez de inventar
um perfil da fonte. Caso contr\xE1rio, retorne APENAS o JSON do artigo, com extens\xE3o
proporcional aos fatos dispon\xEDveis.`;
    const isOpenAIModel = selectedModel.startsWith("openai/");
    let apiKey;
    let apiEndpoint;
    let modelName;
    if (isOpenAIModel) {
      if (!OPENAI_API_KEY) {
        return jsonError("OPENAI_API_KEY n\xE3o configurada para modelo OpenAI", 500);
      }
      apiKey = OPENAI_API_KEY;
      apiEndpoint = "https://api.openai.com/v1/chat/completions";
      modelName = selectedModel.replace("openai/", "");
    } else {
      if (!LOVABLE_API_KEY) {
        return jsonError("LOVABLE_API_KEY n\xE3o configurada para modelo Gemini", 500);
      }
      apiKey = LOVABLE_API_KEY;
      apiEndpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
      modelName = selectedModel;
    }
    const isGpt5 = isOpenAIModel && modelName.startsWith("gpt-5");
    console.log(`[generate-blog-post-from-topic] Enviando para IA (${modelName} via ${isOpenAIModel ? "OpenAI direto" : "Lovable Gateway"})...`);
    const aiResponse = await fetchWithTimeout4(apiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        ...isOpenAIModel ? {} : { temperature },
        ...isGpt5 ? { reasoning_effort: "minimal", verbosity: "high" } : {}
      })
    }, AI_TIMEOUT_MS);
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro na API de IA:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return jsonError("Limite de requisi\xE7\xF5es excedido. Tente em alguns minutos.", 429);
      }
      if (aiResponse.status === 402) {
        return jsonError("Cr\xE9ditos insuficientes. Adicione em Settings \u2192 Workspace \u2192 Usage.", 402);
      }
      throw new Error(`Erro na API: ${aiResponse.status} - ${errorText}`);
    }
    const aiData = await aiResponse.json();
    let generatedContent = aiData.choices?.[0]?.message?.content;
    const usage = aiData.usage || {};
    if (!generatedContent) {
      throw new Error("IA n\xE3o retornou conte\xFAdo");
    }
    generatedContent = generatedContent.trim();
    if (generatedContent.startsWith("```json")) {
      generatedContent = generatedContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (generatedContent.startsWith("```")) {
      generatedContent = generatedContent.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    let articleData;
    try {
      articleData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON:", parseError);
      throw new Error("IA n\xE3o retornou JSON v\xE1lido");
    }
    if (articleData.insufficientSources) {
      console.log(`[generate-blog-post-from-topic] Fontes insuficientes para "${topicLabel}": ${articleData.reason || "sem motivo informado"}`);
      return jsonError(
        `${mode === "source_article" ? `A mat\xE9ria de "${topicLabel}"` : `As fontes encontradas para "${topicLabel}"`} n\xE3o trazem uma not\xEDcia real (parece s\xF3 homepage/institucional) \u2014 nenhum artigo foi gerado. ${articleData.reason ? `Motivo: ${articleData.reason}` : ""}`.trim(),
        422
      );
    }
    if (!articleData.title || !articleData.content) {
      throw new Error("IA n\xE3o gerou dados completos");
    }
    if (!isContentSubstantial(articleData.content)) {
      const plainTextLength = stripHtmlTags(articleData.content).length;
      console.log(`[generate-blog-post-from-topic] Conte\xFAdo curto demais para "${topicLabel}": ${plainTextLength} caracteres de texto real`);
      return jsonError(
        `O artigo gerado para "${topicLabel}" ficou curto demais (${plainTextLength} caracteres de texto real) \u2014 a IA n\xE3o desenvolveu o suficiente. Nenhum artigo foi gerado.`,
        422
      );
    }
    const titleCheck = validateTitle(articleData.title);
    if (!titleCheck.valid) {
      console.warn("[generate-blog-post-from-topic] T\xEDtulo com issues:", titleCheck.issues, "| original:", articleData.title);
    }
    articleData.title = sanitizeTitle(titleCheck.cleaned);
    const allowedCategories = ["Produtores", "Tecnologia", "Cultura", "Lan\xE7amentos", "Festivais", "Cena"];
    const finalCategory = allowedCategories.includes(articleData.category) ? articleData.category : "Cultura";
    const baseSlug = articleData.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let slug = baseSlug;
    let slugExists = true;
    let attempts = 0;
    while (slugExists && attempts < 5) {
      const { data: existingPost } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
      if (existingPost) {
        slug = `${baseSlug}-${Date.now().toString(36)}`;
        attempts++;
      } else {
        slugExists = false;
      }
    }
    const finalContentSubstantial = isContentSubstantial(articleData.content);
    const willPublish = publishImmediately !== false && finalContentSubstantial;
    const { data: post, error: insertError } = await supabase.from("blog_posts").insert({
      title: articleData.title,
      slug,
      excerpt: articleData.excerpt,
      content: articleData.content,
      category: finalCategory,
      published: willPublish,
      published_at: willPublish ? (/* @__PURE__ */ new Date()).toISOString() : null
    }).select().single();
    if (insertError) {
      console.error("Erro ao salvar post:", insertError);
      throw insertError;
    }
    console.log(`[generate-blog-post-from-topic] Post criado: ${post.id}`);
    if (publishImmediately !== false && !finalContentSubstantial) {
      console.warn(`[generate-blog-post-from-topic] Conte\xFAdo curto demais na 2\xAA checagem \u2014 publica\xE7\xE3o autom\xE1tica cancelada, post ${post.id} nasceu como rascunho.`);
      try {
        await supabase.from("application_logs").insert({
          level: "warn",
          message: "generate-blog-post-from-topic: safety-net-downgraded-to-draft",
          context: { postId: post.id, title: articleData.title, generationSource }
        });
      } catch (_) {
      }
    }
    const { error: aiLogError } = await supabase.from("ai_generated_posts").insert({
      blog_post_id: post.id,
      prompt_used: mode === "source_article" ? `Reescrita fiel de mat\xE9ria de "${sourceName || "fonte cadastrada"}": ${sourceUrl}` : `Busca por tema: "${query}" (${sourceUrls.length} fontes)`,
      model_used: selectedModel,
      input_tokens: usage.prompt_tokens || null,
      output_tokens: usage.completion_tokens || null,
      total_tokens: usage.total_tokens || null,
      source_urls: sourceUrls,
      generation_source: generationSource
    });
    if (aiLogError) {
      console.error("Erro ao registrar log de IA:", aiLogError);
    }
    let imageResolvedFromRealSource = false;
    if (FIRECRAWL_API_KEY && (mode === "source_article" || sourceUrls.length > 0)) {
      const referenceUrl = mode === "source_article" ? sourceUrl : sourceUrls[0];
      let referenceName = sourceName || "fonte cadastrada";
      if (mode === "open_search") {
        try {
          referenceName = new URL(referenceUrl).hostname.replace(/^www\./, "");
        } catch {
          referenceName = "fonte real";
        }
      }
      const searchTerm = mode === "source_article" ? articleData.title : query;
      try {
        const resolvedImage = await resolveArticleImage(referenceUrl, referenceName, searchTerm, FIRECRAWL_API_KEY);
        if (resolvedImage) {
          await supabase.from("blog_posts").update({ image_url: resolvedImage.url, image_credit: resolvedImage.credit }).eq("id", post.id);
          post.image_url = resolvedImage.url;
          post.image_credit = resolvedImage.credit;
          imageResolvedFromRealSource = true;
        }
      } catch (imageError) {
        console.error("[generate-blog-post-from-topic] Erro ao resolver imagem da mat\xE9ria:", imageError);
      }
    }
    if (mode === "open_search" && !imageResolvedFromRealSource && generateImage && LOVABLE_API_KEY) {
      try {
        const timeForImage = AI_TIMEOUT_MS - (Date.now() - startTime);
        if (timeForImage > 3e4) {
          const imagePrompt = `Crie uma imagem editorial para um artigo sobre m\xFAsica eletr\xF4nica com o tema: "${articleData.title}". Estilo fotorrealista ou ilustra\xE7\xE3o art\xEDstica, sem texto, sem palavras, sem n\xFAmeros na imagem.`;
          const imageResponse = await fetchWithTimeout4("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: imagePrompt }],
              modalities: ["image", "text"]
            })
          }, 4e4);
          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (base64Image) {
              const base64Data = base64Image.split(",")[1];
              const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
              let fileExt = "png";
              let contentType = "image/png";
              if (imageBytes.length > 12 && imageBytes[0] === 82 && imageBytes[1] === 73) {
                fileExt = "webp";
                contentType = "image/webp";
              }
              const BUNNY_STORAGE_API_KEY = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, "")?.replace(/[^\x20-\x7E]/g, "");
              if (BUNNY_STORAGE_API_KEY) {
                const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
                const fileName = `topic-${Date.now()}.${fileExt}`;
                const uploadResp = await fetch(`https://${bunnyHostname}/mdaccula/event-images/${fileName}`, {
                  method: "PUT",
                  headers: { AccessKey: BUNNY_STORAGE_API_KEY, "Content-Type": contentType },
                  body: imageBytes
                });
                if (uploadResp.ok) {
                  const generatedImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
                  await supabase.from("blog_posts").update({ image_url: generatedImageUrl }).eq("id", post.id);
                  post.image_url = generatedImageUrl;
                }
              }
            }
          }
        }
      } catch (imageError) {
        console.error("[generate-blog-post-from-topic] Erro na gera\xE7\xE3o de imagem:", imageError);
      }
    }
    const totalTime = Date.now() - startTime;
    console.log(`[generate-blog-post-from-topic] Conclu\xEDdo em ${totalTime}ms`);
    return jsonSuccess({
      success: true,
      post,
      sourcesUsed: sourceUrls,
      message: mode === "source_article" ? `Artigo reescrito a partir da mat\xE9ria de "${sourceName || "fonte cadastrada"}"!` : `Artigo gerado a partir de ${sourceUrls.length} fontes!`,
      processingTimeMs: totalTime
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Erro em generate-blog-post-from-topic (${totalTime}ms):`, error);
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError("Opera\xE7\xE3o cancelada por timeout. Tente novamente.", 504);
    }
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido", 500);
  }
});
