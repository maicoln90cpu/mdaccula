// supabase/functions/generate-blog-post-v2/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

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

// supabase/functions/_shared/scrapeGate.ts
function shouldScrapeForContext(opts) {
  const min = opts.minRemainingMs ?? 15e3;
  return opts.hasApiKey && opts.remainingMs > min;
}

// supabase/functions/_shared/firecrawlSearch.ts
var MAX_CONTENT_LENGTH = 2e3;
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
    if (markdown && url) {
      results.push({ title: String(title), url: String(url), content: markdown.substring(0, MAX_CONTENT_LENGTH) });
    }
  }
  return results;
}

// supabase/functions/_shared/eventSourceGuardrail.ts
function shouldRequireSourceVerification(isEventMode, hasEventSignals) {
  return isEventMode && !hasEventSignals;
}
function buildGuardrailSearchQuery(eventName, eventLocation) {
  return [eventName, eventLocation].filter(Boolean).join(" ").trim();
}

// supabase/functions/generate-blog-post-v2/index.ts
function logEgress(supabase, apiPath, data) {
  try {
    const bytes = data ? new TextEncoder().encode(JSON.stringify(data)).length : 0;
    const now = /* @__PURE__ */ new Date();
    now.setMinutes(0, 0, 0);
    supabase.from("egress_metrics").upsert({
      period_start: now.toISOString(),
      api_path: `/rest/v1/${apiPath}`,
      source: "edge",
      cache_hits: 0,
      cache_misses: 1,
      egress_bytes: bytes
    }, { onConflict: "period_start,api_path,source" }).then(() => {
    }).catch(() => {
    });
  } catch (_) {
  }
}
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
function extractKeywords(content) {
  if (!content) return "";
  const stopwords = /* @__PURE__ */ new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "na",
    "no",
    "nas",
    "nos",
    "para",
    "com",
    "por",
    "que",
    "uma",
    "um",
    "os",
    "as",
    "se",
    "ou",
    "mais",
    "isso",
    "esse",
    "essa",
    "este",
    "esta",
    "como",
    "sua",
    "seu",
    "seus",
    "suas",
    "ele",
    "ela",
    "eles",
    "elas",
    "foi",
    "s\xE3o",
    "tem",
    "ter",
    "ser\xE1",
    "sobre",
    "entre",
    "quando",
    "muito",
    "tamb\xE9m",
    "onde",
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "have",
    "has",
    "are",
    "was"
  ]);
  const words = content.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g, " ").split(/\s+/).filter((w) => w.length > 4 && !stopwords.has(w));
  const freq = {};
  words.forEach((w) => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w).join(", ");
}
function inferMood(content, title) {
  const text = (content + " " + title).toLowerCase();
  if (text.includes("festival") || text.includes("celebra") || text.includes("festa")) return "celebrat\xF3rio";
  if (text.includes("underground") || text.includes("techno") || text.includes("warehouse")) return "underground";
  if (text.includes("futuro") || text.includes("tecnologia") || text.includes("ia") || text.includes("digital")) return "futurista";
  if (text.includes("experimental") || text.includes("vanguarda") || text.includes("inovador")) return "experimental";
  if (text.includes("cl\xE1ssico") || text.includes("hist\xF3ria") || text.includes("vintage")) return "nost\xE1lgico";
  if (text.includes("meditativo") || text.includes("ambient") || text.includes("chill")) return "introspectivo";
  return "energ\xE9tico";
}
var FUNCTION_TIMEOUT_MS = 14e4;
async function fetchWithTimeout2(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function scrapeWithFirecrawl(url, apiKey) {
  try {
    const response = await fetchWithTimeout2("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2e3
      })
    }, 5e3);
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
      return { success: false, error: "Scraping timeout" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
var IMAGE_STYLE_PROMPTS = [
  // Estilo 0: Fotorrealista cinematográfico
  `Crie uma imagem FOTORREALISTA e CINEMATOGR\xC1FICA para um artigo sobre m\xFAsica eletr\xF4nica.

CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGAT\xD3RIO: Fotorrealismo cinematogr\xE1fico
- Profundidade de campo rasa (bokeh)
- Ilumina\xE7\xE3o dram\xE1tica com contraste forte (chiaroscuro)
- Tons quentes e frios em equil\xEDbrio
- Composi\xE7\xE3o em regra dos ter\xE7os
- Aspecto de fotografia editorial de alta moda ou concert photography
- Refer\xEAncias visuais: Annie Leibovitz, Tim Walker

EVITE: imagens gen\xE9ricas de boates, DJs de costas, multid\xF5es gen\xE9ricas.
N\xC3O inclua texto, palavras ou n\xFAmeros na imagem.`,
  // Estilo 1: Neon/Cyberpunk
  `Crie uma imagem com est\xE9tica NEON CYBERPUNK para um artigo sobre m\xFAsica eletr\xF4nica.

CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGAT\xD3RIO: Arte digital neon/cyberpunk
- Cores neon vibrantes: magenta, ciano, roxo el\xE9trico, verde neon
- Gradientes intensos e brilho luminoso (glow effects)
- Est\xE9tica futurista urbana, luzes de LED, reflexos em superf\xEDcies molhadas
- Atmosfera noturna com neblina colorida
- Refer\xEAncias visuais: Blade Runner, Tron, arte de Beeple
- Composi\xE7\xE3o din\xE2mica com linhas de luz

EVITE: imagens flat ou sem profundidade, cenas diurnas.
N\xC3O inclua texto, palavras ou n\xFAmeros na imagem.`,
  // Estilo 2: Ilustração artística / pintura digital
  `Crie uma ILUSTRA\xC7\xC3O ART\xCDSTICA estilo pintura digital para um artigo sobre m\xFAsica eletr\xF4nica.

CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGAT\xD3RIO: Pintura digital / ilustra\xE7\xE3o art\xEDstica
- Texturas pict\xF3ricas vis\xEDveis (como pintura a \xF3leo ou aquarela digital)
- Paleta de cores expressiva e ousada
- Pinceladas vis\xEDveis que d\xE3o energia e movimento
- Mistura de realismo com elementos abstratos
- Refer\xEAncias visuais: concept art, arte de \xE1lbum, ilustra\xE7\xE3o editorial
- Composi\xE7\xE3o expressionista com foco emocional

EVITE: fotorrealismo, renderiza\xE7\xE3o 3D limpa, imagens flat.
N\xC3O inclua texto, palavras ou n\xFAmeros na imagem.`,
  // Estilo 3: Minimalista abstrato
  `Crie uma imagem MINIMALISTA e ABSTRATA para um artigo sobre m\xFAsica eletr\xF4nica.

CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGAT\xD3RIO: Minimalismo abstrato
- Formas geom\xE9tricas limpas e precisas
- Paleta de cores reduzida (m\xE1ximo 3-4 cores)
- Muito espa\xE7o negativo e respira\xE7\xE3o visual
- Gradientes suaves e transi\xE7\xF5es elegantes
- Refer\xEAncias visuais: arte de capa da Kompakt, Raster-Noton, design su\xED\xE7o
- Composi\xE7\xE3o equilibrada e sofisticada

EVITE: excesso de detalhes, fotorrealismo, polui\xE7\xE3o visual.
N\xC3O inclua texto, palavras ou n\xFAmeros na imagem.`,
  // Estilo 4: Colagem editorial / mixed media
  `Crie uma imagem estilo COLAGEM EDITORIAL / MIXED MEDIA para um artigo sobre m\xFAsica eletr\xF4nica.

CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGAT\xD3RIO: Colagem editorial e mixed media
- Sobreposi\xE7\xE3o de camadas e texturas diferentes
- Mistura de fotografia com elementos gr\xE1ficos e tipogr\xE1ficos
- Est\xE9tica de revista, zine ou poster de evento underground
- Texturas de papel rasgado, grunge, halftone, risograph
- Refer\xEAncias visuais: David Carson, Neville Brody, posters de rave dos anos 90
- Composi\xE7\xE3o desconstru\xEDda e energ\xE9tica

EVITE: imagens limpas demais, fotorrealismo puro, simetria perfeita.
N\xC3O inclua texto, palavras ou n\xFAmeros na imagem.`
];
async function pickRandomStyle(supabase) {
  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", "last_image_style_index").maybeSingle();
  const lastIndex = parseInt(setting?.value || "-1", 10);
  const availableIndices = IMAGE_STYLE_PROMPTS.map((_, i) => i).filter((i) => i !== lastIndex);
  const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  await supabase.from("site_settings").upsert(
    { key: "last_image_style_index", value: String(nextIndex), updated_at: (/* @__PURE__ */ new Date()).toISOString() },
    { onConflict: "key" }
  );
  console.log(`\u{1F3A8} Estilo de imagem selecionado: ${nextIndex} (\xFAltimo: ${lastIndex})`);
  return { index: nextIndex, prompt: IMAGE_STYLE_PROMPTS[nextIndex] };
}
function replaceVariables(text, fields) {
  if (!text) return text;
  let result = text;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== void 0 && value !== null && value !== "") {
      const strValue = String(value);
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), strValue);
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), strValue);
    }
  }
  result = result.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
  result = result.replace(/\{[a-zA-Z_]+\}/g, "");
  return result;
}
var FAKE_DOMAINS = [
  "ticketlink.com.br",
  "ticketlink.com",
  "ingressos.com",
  "ingressos.com.br",
  "tickets.com.br",
  "tickets.com",
  "example.com",
  "evento.com.br",
  "evento.com",
  "link.com.br",
  "comprar.com.br",
  "bilheteria.com.br",
  "bilheteria.com",
  "eventbrite.fake",
  "sympla.fake"
];
function restrictLinkToFirstMention(content, url) {
  if (!url) return content;
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkRegex = new RegExp(`<a[^>]*href=["']${escapedUrl}["'][^>]*>([^<]*)</a>`, "gi");
  let firstSeen = false;
  return content.replace(linkRegex, (match, innerText) => {
    if (!firstSeen) {
      firstSeen = true;
      return match;
    }
    return innerText;
  });
}
function removeFakeLinks(content) {
  let cleaned = content;
  for (const domain of FAKE_DOMAINS) {
    const linkRegex = new RegExp(
      `<a[^>]*href=['"](?:https?://)?(?:www\\.)?${domain.replace(/\./g, "\\.")}[^'"]*['"][^>]*>[^<]*</a>`,
      "gi"
    );
    cleaned = cleaned.replace(linkRegex, "");
    const plainUrlRegex = new RegExp(
      `(?:https?://)?(?:www\\.)?${domain.replace(/\./g, "\\.")}[^\\s<]*`,
      "gi"
    );
    cleaned = cleaned.replace(plainUrlRegex, "");
  }
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}
async function generateAndAttachImage(supabase, opts) {
  const bgStart = Date.now();
  const MAX_IMAGE_ATTEMPTS = 2;
  const IMAGE_BUDGET_MS = 9e4;
  try {
    for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
      if (Date.now() - bgStart > IMAGE_BUDGET_MS) {
        console.warn(`[bg-image] Budget esgotado antes da tentativa ${attempt}`);
        break;
      }
      try {
        console.log(`[bg-image] \u{1F3A8} Tentativa ${attempt}/${MAX_IMAGE_ATTEMPTS} para post ${opts.postId}`);
        let selectedPromptTemplate;
        if (opts.customImagePrompt) {
          selectedPromptTemplate = opts.customImagePrompt;
        } else {
          const style = await pickRandomStyle(supabase);
          selectedPromptTemplate = style.prompt;
          console.log(`[bg-image] Estilo variado #${style.index}`);
        }
        const imagePrompt = selectedPromptTemplate.replace(/\{\{title\}\}/g, opts.imageTitle).replace(/\{\{summary\}\}/g, opts.imageSummary).replace(/\{\{category\}\}/g, opts.imageCategory).replace(/\{\{keywords\}\}/g, opts.imageKeywords).replace(/\{\{mood\}\}/g, opts.imageMood).replace(/\{\{visualElements\}\}/g, opts.imageVisualElements);
        const imageTimeout = 45e3;
        const imageResponse = await fetchWithTimeout2("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${opts.lovableApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"]
          })
        }, imageTimeout);
        if (!imageResponse.ok) {
          console.error(`[bg-image] Tentativa ${attempt}: status ${imageResponse.status}`);
          continue;
        }
        const imageData = await imageResponse.json();
        const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        const imageTokensUsed = imageData.usage?.total_tokens || 0;
        if (!base64Image) {
          console.error(`[bg-image] Tentativa ${attempt}: sem base64`);
          continue;
        }
        const base64Data = base64Image.split(",")[1];
        if (!base64Data || base64Data.length < 1024) {
          console.error(`[bg-image] Tentativa ${attempt}: base64 muito pequeno`);
          continue;
        }
        const pngBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        if (pngBuffer.length < 1024) {
          console.error(`[bg-image] Tentativa ${attempt}: buffer pequeno`);
          continue;
        }
        let finalBuffer;
        let fileExt = "png";
        let contentType = "image/png";
        try {
          const image = await Image.decode(pngBuffer);
          const maxDimension = 1024;
          if (image.width > maxDimension || image.height > maxDimension) {
            const scale = maxDimension / Math.max(image.width, image.height);
            image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
          }
          finalBuffer = await image.encodeWEBP(85);
          fileExt = "webp";
          contentType = "image/webp";
        } catch (conversionError) {
          console.error("[bg-image] Falha WebP, usando PNG:", conversionError);
          finalBuffer = pngBuffer;
        }
        const fileName = `ai-generated-${Date.now()}.${fileExt}`;
        const BUNNY_STORAGE_API_KEY = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, "")?.replace(/[^\x20-\x7E]/g, "");
        if (!BUNNY_STORAGE_API_KEY) {
          console.error("[bg-image] BUNNY_STORAGE_API_KEY ausente");
          break;
        }
        const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
        const bunnyUploadUrl = `https://${bunnyHostname}/mdaccula/event-images/${fileName}`;
        const uploadResp = await fetch(bunnyUploadUrl, {
          method: "PUT",
          headers: { AccessKey: BUNNY_STORAGE_API_KEY, "Content-Type": contentType },
          body: finalBuffer
        });
        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          console.error(`[bg-image] Upload Bunny falhou (${uploadResp.status}):`, errText);
          continue;
        }
        const generatedImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
        console.log(`[bg-image] \u2705 Upload OK: ${generatedImageUrl}`);
        const { error: updateErr } = await supabase.from("blog_posts").update({ image_url: generatedImageUrl }).eq("id", opts.postId);
        if (updateErr) {
          console.error("[bg-image] Erro ao atualizar blog_posts.image_url:", updateErr);
        } else {
          console.log(`[bg-image] \u2705 Post ${opts.postId} atualizado com capa em ${Date.now() - bgStart}ms`);
        }
        if (imageTokensUsed > 0) {
          await supabase.from("ai_generated_posts").update({ image_tokens: imageTokensUsed }).eq("blog_post_id", opts.postId).then(() => {
          }).catch(() => {
          });
        }
        return;
      } catch (innerErr) {
        console.error(`[bg-image] Erro tentativa ${attempt}:`, innerErr);
      }
    }
    console.warn(`[bg-image] \u26A0\uFE0F Todas as tentativas falharam para post ${opts.postId}`);
  } catch (outerErr) {
    console.error("[bg-image] Erro fatal no background:", outerErr);
  }
}
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const startTime = Date.now();
  try {
    let computeWeekday = function(dateStr) {
      if (!dateStr || typeof dateStr !== "string") return "";
      const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return "";
      const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return WEEKDAYS_PT[dt.getDay()] || "";
    }, computeDateFormatted = function(dateStr) {
      const m = dateStr?.match?.(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return dateStr || "";
      const wd = computeWeekday(dateStr);
      return `${Number(m[3])} de ${MONTHS_PT[Number(m[2]) - 1]} de ${m[1]}${wd ? ` (${wd})` : ""}`;
    };
    const body = await req.json();
    const { templateId, generateImage, publishImmediately, ...formFields } = body;
    console.log("[generate-blog-post-v2] Campos recebidos:", JSON.stringify(Object.keys(formFields)));
    console.log("[generate-blog-post-v2] Valores principais:", JSON.stringify({
      eventName: formFields.eventName,
      title: formFields.title,
      eventDate: formFields.eventDate,
      venue: formFields.venue,
      lineup: formFields.lineup,
      ticketLink: formFields.ticketLink
    }));
    const eventName = formFields.eventName || formFields.title;
    if (!eventName) {
      return jsonError("Nome do evento (eventName ou title) \xE9 obrigat\xF3rio para gerar o artigo", 400);
    }
    if (!formFields.eventLocation && (formFields.venue || formFields.locationCity)) {
      const seenParts = /* @__PURE__ */ new Set();
      formFields.eventLocation = [
        formFields.venue,
        formFields.locationCity,
        formFields.locationState
      ].filter((part) => {
        if (!part) return false;
        const key = String(part).trim().toLowerCase();
        if (seenParts.has(key)) return false;
        seenParts.add(key);
        return true;
      }).join(" - ");
      console.log("[generate-blog-post-v2] eventLocation composto:", formFields.eventLocation);
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError("Configura\xE7\xE3o de ambiente incompleta", 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase.from("site_settings").select("key, value").in("key", ["ai_blog_model", "ai_temperature", "ai_image_prompt_template", "ai_max_scrape_sources", "ai_max_article_length"]);
    const settingsMap = {};
    settings?.forEach((s) => {
      settingsMap[s.key] = s.value || "";
    });
    logEgress(supabase, "site_settings", settings);
    const selectedModel = settingsMap["ai_blog_model"] || "google/gemini-2.5-flash";
    const temperature = parseFloat(settingsMap["ai_temperature"] || "0.9");
    const customImagePrompt = settingsMap["ai_image_prompt_template"] || "";
    const maxScrapeSources = parseInt(settingsMap["ai_max_scrape_sources"] || "2");
    const maxArticleLength = parseInt(settingsMap["ai_max_article_length"] || "5000");
    console.log("Configura\xE7\xF5es carregadas:", { selectedModel, temperature, maxScrapeSources, maxArticleLength });
    const elapsedMs = Date.now() - startTime;
    const remainingMs = FUNCTION_TIMEOUT_MS - elapsedMs;
    let scrapedContext = "";
    if (FIRECRAWL_API_KEY && shouldScrapeForContext({ hasApiKey: true, remainingMs })) {
      try {
        const { data: sources } = await supabase.from("event_sources").select("name, url").eq("enabled", true).limit(maxScrapeSources);
        if (sources && sources.length > 0) {
          logEgress(supabase, "event_sources", sources);
          console.log("Scraping fontes para contexto adicional...");
          for (const source of sources) {
            if (Date.now() - startTime > FUNCTION_TIMEOUT_MS - 12e3) {
              console.log("Skipping remaining sources due to time constraints");
              break;
            }
            const result = await scrapeWithFirecrawl(source.url, FIRECRAWL_API_KEY);
            if (result.success && result.markdown) {
              const truncated = result.markdown.substring(0, 1500);
              scrapedContext += `

### Contexto de ${source.name}:
${truncated}`;
              console.log(`\u2713 Contexto obtido de ${source.name}`);
            }
          }
        }
      } catch (scrapeError) {
        console.log("Scraping opcional falhou, continuando sem contexto adicional");
      }
    }
    let template;
    if (templateId) {
      const { data, error } = await supabase.from("ai_prompt_templates").select("*").eq("id", templateId).single();
      if (error) throw new Error(`Template n\xE3o encontrado: ${error.message}`);
      template = data;
    } else {
      const { data: defaultTemplates, error } = await supabase.from("ai_prompt_templates").select("*").eq("is_default", true).eq("category", "Eventos").order("created_at", { ascending: true }).limit(1);
      if (error || !defaultTemplates || defaultTemplates.length === 0) {
        console.log("Template default de Eventos n\xE3o encontrado, buscando fallback...");
        const { data: fallbackTemplates, error: fallbackError } = await supabase.from("ai_prompt_templates").select("*").eq("category", "Eventos").eq("enabled", true).order("created_at", { ascending: true }).limit(1);
        if (fallbackError || !fallbackTemplates || fallbackTemplates.length === 0) {
          throw new Error("Nenhum template de eventos encontrado no sistema");
        }
        template = fallbackTemplates[0];
        console.log(`Usando template fallback: ${template.name}`);
      } else {
        template = defaultTemplates[0];
        console.log(`Usando template default: ${template.name}`);
      }
    }
    const WEEKDAYS_PT = ["domingo", "segunda-feira", "ter\xE7a-feira", "quarta-feira", "quinta-feira", "sexta-feira", "s\xE1bado"];
    const MONTHS_PT = ["janeiro", "fevereiro", "mar\xE7o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    if (formFields.eventDate && !formFields.weekday) {
      formFields.weekday = computeWeekday(String(formFields.eventDate));
    }
    if (formFields.eventDate && !formFields.dateFormatted) {
      formFields.dateFormatted = computeDateFormatted(String(formFields.eventDate));
    }
    let userPrompt = template.user_prompt_template;
    for (const [key, value] of Object.entries(formFields)) {
      if (value) {
        userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        userPrompt = userPrompt.replace(
          new RegExp(`\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, "g"),
          "$1"
        );
      } else {
        userPrompt = userPrompt.replace(
          new RegExp(`\\{\\{#if ${key}\\}\\}[\\s\\S]*?\\{\\{/if\\}\\}`, "g"),
          ""
        );
      }
    }
    const hasEventSignals = Boolean(
      formFields.eventDate || formFields.venue || formFields.lineup || formFields.eventTime || formFields.address || formFields.locationCity
    );
    const templateIsEvent = template.category === "Eventos" || template.category === "Festivais";
    const isEventMode = hasEventSignals || templateIsEvent;
    console.log(`[generate-blog-post-v2] Modo: ${isEventMode ? "EVENTO" : "EDITORIAL"} | template="${template.name}" (${template.category}) | hasEventSignals=${hasEventSignals}`);
    let guardrailSourceUrls = null;
    if (shouldRequireSourceVerification(isEventMode, hasEventSignals)) {
      if (!FIRECRAWL_API_KEY) {
        return jsonError(
          "Este template de evento n\xE3o tem dados reais associados (data, local, lineup) e a verifica\xE7\xE3o de fontes (FIRECRAWL_API_KEY) n\xE3o est\xE1 configurada \u2014 gera\xE7\xE3o bloqueada por seguran\xE7a.",
          500
        );
      }
      const guardrailQuery = buildGuardrailSearchQuery(eventName, formFields.eventLocation);
      console.log(`[generate-blog-post-v2] Modo evento sem sinal real \u2014 verificando fonte real para: "${guardrailQuery}"`);
      let guardrailResults;
      try {
        guardrailResults = await searchWithFirecrawl(guardrailQuery, FIRECRAWL_API_KEY, 5, 3e4);
      } catch (searchError) {
        console.error("[generate-blog-post-v2] Falha na busca de verifica\xE7\xE3o de fonte:", searchError);
        return jsonError("N\xE3o foi poss\xEDvel verificar fontes reais agora (falha na busca). Tente novamente em instantes.", 502);
      }
      if (guardrailResults.length === 0) {
        return jsonError(
          `Nenhuma fonte real encontrada para "${eventName}". Nenhum artigo foi criado \u2014 confirme os dados manualmente ou tente um termo mais espec\xEDfico.`,
          404
        );
      }
      guardrailSourceUrls = guardrailResults.map((r) => r.url);
      const guardrailSourcesBlock = guardrailResults.map((r, i) => `### Fonte ${i + 1}: ${r.title} (${r.url})
${r.content}`).join("\n\n---\n\n");
      userPrompt = `

\u{1F4F0} FONTES REAIS ENCONTRADAS (use literalmente pra confirmar lineup/local/hor\xE1rio do evento, NUNCA invente al\xE9m do que est\xE1 aqui):
${guardrailSourcesBlock}

` + userPrompt;
      console.log(`[generate-blog-post-v2] ${guardrailResults.length} fonte(s) real(is) encontrada(s), prosseguindo.`);
    }
    if (isEventMode) {
      const officialDataLines = [];
      const pushIf = (label, val) => {
        if (val !== void 0 && val !== null && String(val).trim() !== "") {
          officialDataLines.push(`- ${label}: ${val}`);
        }
      };
      pushIf("Nome do evento", formFields.eventName || formFields.title);
      pushIf("Subt\xEDtulo/Promo\xE7\xE3o", formFields.subtitle);
      pushIf("Data", formFields.dateFormatted || formFields.eventDate);
      pushIf("Dia da semana", formFields.weekday);
      pushIf("Hor\xE1rio de in\xEDcio", formFields.eventTime);
      pushIf("Hor\xE1rio de t\xE9rmino", formFields.endTime);
      pushIf("Local", formFields.eventLocation);
      const venueEqualsCity = Boolean(
        formFields.venue && formFields.locationCity && String(formFields.venue).trim().toLowerCase() === String(formFields.locationCity).trim().toLowerCase()
      );
      pushIf("Casa/Venue", formFields.venue);
      pushIf("Endere\xE7o", formFields.address);
      if (!venueEqualsCity) {
        pushIf("Cidade", formFields.locationCity);
      }
      pushIf("Estado", formFields.locationState);
      pushIf("G\xEAneros musicais", formFields.genres);
      pushIf("Lineup confirmado", formFields.lineup);
      pushIf("Link de ingressos", formFields.ticketLink);
      pushIf("Link VIP/camarote", formFields.vipLink);
      pushIf("Descri\xE7\xE3o oficial", formFields.description);
      if (officialDataLines.length > 0) {
        const officialDataBlock = `

\u{1F4CB} DADOS OFICIAIS DO EVENTO (use literalmente, NUNCA invente, NUNCA contradiga):
${officialDataLines.join("\n")}

\u26A0\uFE0F Se algum dado acima estiver presente, ele DEVE aparecer no artigo. N\xE3o escreva "a confirmar" para informa\xE7\xF5es que constam aqui.
`;
        userPrompt = officialDataBlock + userPrompt;
      }
    }
    console.log("[generate-blog-post-v2] User prompt ap\xF3s substitui\xE7\xF5es (preview):", userPrompt.substring(0, 1200));
    const hasRealTicketLink = formFields.ticketLink && typeof formFields.ticketLink === "string" && formFields.ticketLink.length > 5 && !FAKE_DOMAINS.some((domain) => formFields.ticketLink.includes(domain));
    const aiCtxLower = String(formFields.aiContext || "").toLowerCase();
    const isCourtesy = /\b(cortesia|free|gratuito|gratuita|sem venda|sem ingresso|guest list|lista de convidados|open list)\b/.test(aiCtxLower);
    const aiContextBlock = formFields.aiContext ? `

\u{1F3AF} INSTRU\xC7\xD5ES ESPECIAIS DO ADMIN (PRIORIDADE M\xC1XIMA \u2014 respeite literalmente, sobrep\xF5e template e conhecimento pr\xE9vio):
${formFields.aiContext}` : "";
    const eventAntiHedgingBlock = isEventMode ? `

\u{1F6A8} ANTI-HEDGING (proibido falar "a confirmar" quando o dado existe):
${formFields.lineup ? '- Lineup foi fornecido: N\xC3O escreva "lineup a confirmar" ou "line-up completo ainda n\xE3o oficializado". Liste os artistas exatos.' : ""}
${formFields.endTime ? '- Hor\xE1rio de t\xE9rmino foi fornecido: mencione-o ("at\xE9 XX:XX").' : ""}
${formFields.eventTime ? "- Hor\xE1rio de in\xEDcio foi fornecido: mencione-o." : ""}
${formFields.address ? "- Endere\xE7o completo foi fornecido: inclua-o." : ""}
${formFields.subtitle ? "- Subt\xEDtulo/promo\xE7\xE3o foi fornecido: incorpore essa informa\xE7\xE3o no artigo." : ""}
${formFields.vipLink ? '- Link VIP foi fornecido: mencione a op\xE7\xE3o de camarote/VIP em UM \xDANICO ponto do artigo \u2014 nunca repita a mesma men\xE7\xE3o em duas se\xE7\xF5es diferentes (ex: n\xE3o repita na conclus\xE3o se j\xE1 mencionou na se\xE7\xE3o de ingressos). Use um texto de link natural e curto (ex: "reserve sua \xE1rea VIP", "fale sobre o camarote"). NUNCA copie a frase "\xE1rea VIP/camarote" literalmente como texto do link.' : ""}
${formFields.weekday ? `- Dia da semana CORRETO \xE9 "${formFields.weekday}". NUNCA escreva outro dia da semana.` : ""}

\u{1F6A8} PRIORIDADE DOS CAMPOS ESTRUTURADOS:
- Em caso de conflito entre "description" e os dados estruturados (venue, eventLocation, eventDate, weekday), PRIORIZE os dados estruturados.
- N\xE3o use seu conhecimento de treinamento sobre locais/datas/lineup do evento \u2014 use APENAS os DADOS OFICIAIS.` : "";
    const editorialModeBlock = !isEventMode ? `

\u{1F4F0} MODO EDITORIAL/NOT\xCDCIA (N\xC3O \xE9 evento/festa):
- Este artigo \xE9 uma mat\xE9ria jornal\xEDstica, opinativa ou de tend\xEAncias \u2014 N\xC3O \xE9 divulga\xE7\xE3o de festa.
- PROIBIDO criar se\xE7\xF5es "Lineup", "Local e hor\xE1rio", "Ingressos", "Como chegar".
- PROIBIDO escrever "a confirmar", "lineup a confirmar", "venue a confirmar" \u2014 n\xE3o h\xE1 evento concreto.
- Estrutura esperada: introdu\xE7\xE3o cativante + 3-4 se\xE7\xF5es <h3> com an\xE1lise/contexto + conclus\xE3o com perspectiva.
- Cite artistas, labels, faixas, eventos passados ou tecnologias quando relevante para argumentar.
- Foque no tema do t\xEDtulo e do resumo. Nunca force o texto para um formato de divulga\xE7\xE3o de evento.` : "";
    const ticketsBlock = !isEventMode ? `

\u{1F6A8} LINKS E CTA (modo editorial):
- N\xC3O inclua se\xE7\xE3o de "Ingressos" nem mencione cupom MDACCULA \u2014 n\xE3o \xE9 divulga\xE7\xE3o de evento.
- NUNCA invente URLs.
- CTA final sugerido: "Acompanhe a MDAccula para mais novidades da cena eletr\xF4nica."` : isCourtesy ? `

\u{1F6A8} REGRAS CR\xCDTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- \u26A0\uFE0F ESTE EVENTO \xC9 CORTESIA / SEM VENDA DE INGRESSOS (conforme aiContext acima).
- N\xC3O mencione cupom de desconto MDACCULA.
- N\xC3O escreva "garanta seu ingresso", "compre antecipado", "lotes" ou similares.
- Se houver link, descreva-o como "link para confirmar presen\xE7a / lista" e n\xE3o como compra.
- Ignore qualquer instru\xE7\xE3o do template que force men\xE7\xE3o a cupom de desconto.` : hasRealTicketLink ? `

\u{1F6A8} REGRAS CR\xCDTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- Link de ingressos REAL fornecido: ${formFields.ticketLink}
- Voc\xEA PODE incluir se\xE7\xE3o de ingressos com cupom MDACCULA usando este link.` : `

\u{1F6A8} REGRAS CR\xCDTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- N\xC3O h\xE1 link de ingressos fornecido para este artigo.
- NUNCA INVENTE URLs de ingressos como "ticketlink.com.br", "ingressos.com.br", etc.
- N\xC3O inclua se\xE7\xE3o de "Ingressos", "Onde comprar" ou "Garanta seu lugar".
- N\xC3O mencione cupom de desconto MDACCULA se n\xE3o houver link real.
- Use CTA alternativo: "Acompanhe a MDAccula para mais novidades da cena eletr\xF4nica."`;
    const systemPromptWithLength = template.system_prompt + `

\u{1F6A8} HIERARQUIA DE PRIORIDADE (ordem absoluta):
1. INSTRU\xC7\xD5ES ESPECIAIS DO ADMIN (aiContext)
2. ${isEventMode ? "DADOS OFICIAIS DO EVENTO (bloco no user prompt)" : "Tema do t\xEDtulo/resumo da sugest\xE3o"}
3. Template
4. Conhecimento pr\xE9vio (use APENAS para complementar, nunca para contradizer)

IMPORTANTE: 
- O artigo deve ter no m\xE1ximo ${maxArticleLength} caracteres.
- NUNCA use placeholders como {{eventName}}, {{eventDate}}, {{lineup}}, etc. no texto gerado.
- ${isEventMode ? 'Use os valores REAIS fornecidos no bloco "DADOS OFICIAIS".' : "Baseie-se no t\xEDtulo e resumo fornecidos."}
- Se um campo N\xC3O existe nos dados fornecidos, omita \u2014 NUNCA invente.${eventAntiHedgingBlock}${editorialModeBlock}
${EDITORIAL_QUALITY_BLOCK}

\u{1F3AC} REGRAS OBRIGAT\xD3RIAS PARA O T\xCDTULO (campo "title" do JSON):
O t\xEDtulo precisa ser EDITORIAL, envolvente e chamativo \u2014 como manchete de revista de m\xFAsica eletr\xF4nica.

PROIBIDO no t\xEDtulo:
- Emojis (\u2600\uFE0F, \u{1F441}\uFE0F, \u{1F3B5}, \u2B50 etc.)
- Separar campos com " | ", " \u2014 " ou " - " no estilo "Nome | DD/MM | Cidade"
- Datas no formato "DD/MM/AAAA" ou "DD/MM" (use linguagem temporal natural)
- Come\xE7ar com "Confira", "N\xE3o perca", "Saiba tudo sobre", "Tudo sobre"
- Inventar adjetivos n\xE3o embasados nos dados

OBRIGAT\xD3RIO no t\xEDtulo:
- 50 a 80 caracteres
- Voz ativa, sugerindo clima/atmosfera${formFields.weekday && isEventMode ? ` (dia correto: "${formFields.weekday}")` : ""}
- Sempre baseado em fatos reais \u2014 nunca inventar

${aiContextBlock}${ticketsBlock}`;
    const isOpenAIModel = selectedModel.startsWith("openai/");
    let apiKey;
    let apiEndpoint;
    let modelName;
    if (isOpenAIModel) {
      if (!OPENAI_API_KEY) {
        return jsonError("OPENAI_API_KEY n\xE3o configurada. Configure em Settings \u2192 Secrets.", 500);
      }
      apiKey = OPENAI_API_KEY;
      apiEndpoint = "https://api.openai.com/v1/chat/completions";
      modelName = selectedModel.replace("openai/", "");
      console.log(`Usando OpenAI API diretamente com modelo: ${modelName}`);
    } else {
      if (!LOVABLE_API_KEY) {
        return jsonError("LOVABLE_API_KEY n\xE3o configurada", 500);
      }
      apiKey = LOVABLE_API_KEY;
      apiEndpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
      modelName = selectedModel;
      console.log(`Usando Lovable AI Gateway com modelo: ${modelName}`);
    }
    console.log("Template usado:", template.name);
    console.log("Gerar imagem:", generateImage);
    const requestBody = {
      model: modelName,
      messages: [
        { role: "system", content: systemPromptWithLength + (scrapedContext ? `

## CONTEXTO ADICIONAL DAS FONTES DE NOT\xCDCIAS:
Use estas informa\xE7\xF5es reais para enriquecer o artigo:${scrapedContext}` : "") },
        { role: "user", content: userPrompt }
      ]
    };
    if (selectedModel.startsWith("google/gemini") && !selectedModel.includes("image")) {
      requestBody.temperature = temperature;
      console.log(`Usando temperature ${temperature} para modelo Gemini`);
    } else if (isOpenAIModel && modelName.startsWith("gpt-5")) {
      requestBody.reasoning_effort = "minimal";
      requestBody.verbosity = "high";
      console.log("Usando reasoning_effort=minimal, verbosity=high para modelo gpt-5*");
    }
    const elapsedBeforeAI = Date.now() - startTime;
    const aiTextCap = 11e4;
    const aiTextTimeout = Math.min(aiTextCap, FUNCTION_TIMEOUT_MS - elapsedBeforeAI - 5e3);
    console.log(`\u23F1\uFE0F AI text timeout: ${aiTextTimeout}ms (cap=${aiTextCap}ms, elapsed: ${elapsedBeforeAI}ms, imagem ser\xE1 em background)`);
    if (aiTextTimeout < 1e4) {
      return jsonError("Tempo insuficiente para gera\xE7\xE3o. Tente novamente.", 504);
    }
    const aiResponse = await fetchWithTimeout2(apiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    }, aiTextTimeout);
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro na API Lovable AI:", aiResponse.status, errorText);
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
    console.log("Conte\xFAdo bruto recebido:", generatedContent);
    generatedContent = generatedContent.trim();
    if (generatedContent.startsWith("```json")) {
      generatedContent = generatedContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (generatedContent.startsWith("```")) {
      generatedContent = generatedContent.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    let eventData;
    try {
      eventData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON:", parseError);
      console.error("Conte\xFAdo recebido:", generatedContent);
      throw new Error("IA n\xE3o retornou JSON v\xE1lido");
    }
    if (!eventData.title || !eventData.content) {
      throw new Error("IA n\xE3o gerou dados completos. Tente novamente com mais detalhes.");
    }
    console.log("[generate-blog-post-v2] Aplicando p\xF3s-processamento de vari\xE1veis...");
    eventData.title = replaceVariables(eventData.title, formFields);
    eventData.excerpt = replaceVariables(eventData.excerpt || "", formFields);
    eventData.content = replaceVariables(eventData.content, formFields);
    const titleCheck = validateTitle(eventData.title);
    if (!titleCheck.valid) {
      console.warn("[generate-blog-post-v2] T\xEDtulo com issues:", titleCheck.issues, "| original:", eventData.title);
    }
    eventData.title = sanitizeTitle(titleCheck.cleaned);
    if (formFields.ticketLink && hasRealTicketLink) {
      eventData.content = eventData.content.replace(/\[TICKET_LINK\]/g, formFields.ticketLink).replace(/href='LINK'/g, `href='${formFields.ticketLink}'`).replace(/href="LINK"/g, `href="${formFields.ticketLink}"`);
    }
    console.log("[generate-blog-post-v2] Removendo links fake...");
    const contentBefore = eventData.content.length;
    eventData.content = removeFakeLinks(eventData.content);
    const contentAfter = eventData.content.length;
    if (contentBefore !== contentAfter) {
      console.log(`[generate-blog-post-v2] Links fake removidos: ${contentBefore - contentAfter} caracteres`);
    }
    if (formFields.vipLink) {
      eventData.content = restrictLinkToFirstMention(eventData.content, formFields.vipLink);
    }
    console.log("[generate-blog-post-v2] T\xEDtulo ap\xF3s p\xF3s-processamento:", eventData.title);
    const finalCategory = eventData.category || formFields.category || "Eventos";
    let generatedImageUrl = formFields.eventImageUrl || formFields.imageUrl || null;
    const imageTokensUsed = 0;
    const shouldQueueImage = generateImage && !generatedImageUrl && !!LOVABLE_API_KEY;
    const imageBgOpts = shouldQueueImage ? {
      imageTitle: eventData.title || formFields.title,
      imageSummary: eventData.excerpt || formFields.summary || "",
      imageCategory: eventData.category || formFields.category || "M\xFAsica Eletr\xF4nica",
      imageKeywords: extractKeywords(eventData.content || ""),
      imageMood: inferMood(eventData.content || "", eventData.title || formFields.title),
      imageVisualElements: `${eventData.title || formFields.title}, ${eventData.category || formFields.category || ""}, ${eventData.excerpt || formFields.summary || ""}`.substring(0, 200),
      customImagePrompt,
      lovableApiKey: LOVABLE_API_KEY
    } : null;
    console.log(`\u{1F4F8} Imagem em background: ${shouldQueueImage}`);
    const baseSlug = eventData.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
    console.log("[generate-blog-post-v2] Slug gerado:", slug);
    let post;
    let insertError;
    if (formFields.existingPostId) {
      console.log("[generate-blog-post-v2] Atualizando post existente:", formFields.existingPostId);
      const { data, error } = await supabase.from("blog_posts").update({
        title: eventData.title,
        excerpt: eventData.excerpt,
        content: eventData.content,
        category: finalCategory,
        // Manter imagem existente se não gerou nova
        ...generatedImageUrl && { image_url: generatedImageUrl }
      }).eq("id", formFields.existingPostId).select().single();
      post = data;
      insertError = error;
    } else {
      const { data, error } = await supabase.from("blog_posts").insert({
        title: eventData.title,
        slug,
        excerpt: eventData.excerpt,
        content: eventData.content,
        category: finalCategory,
        published: publishImmediately === false ? false : true,
        published_at: publishImmediately === false ? null : (/* @__PURE__ */ new Date()).toISOString(),
        image_url: generatedImageUrl
      }).select().single();
      post = data;
      insertError = error;
    }
    if (insertError) {
      console.error("Erro ao salvar post:", insertError);
      throw insertError;
    }
    const promptFieldsSummary = Object.entries(formFields).filter(([_, value]) => value).map(([key, value]) => `${key}: ${String(value).substring(0, 50)}`).join(" | ");
    const { error: aiLogError } = await supabase.from("ai_generated_posts").insert({
      blog_post_id: post.id,
      prompt_used: `Template: ${template.name} | ${promptFieldsSummary}`,
      model_used: selectedModel,
      template_id: template.id,
      input_tokens: usage.prompt_tokens || null,
      output_tokens: usage.completion_tokens || null,
      total_tokens: usage.total_tokens || null,
      image_tokens: imageTokensUsed > 0 ? imageTokensUsed : null,
      // scrapedContext (tom/estilo genérico) nunca é gravado aqui — não são citações
      // factuais. guardrailSourceUrls só é não-nulo quando o guardrail acima
      // (isEventMode && !hasEventSignals) encontrou fonte real de verdade pra esse
      // evento específico — mesmo padrão do que generate-blog-post-from-topic já
      // grava pra sugestões ancoradas em busca real.
      source_urls: guardrailSourceUrls
    });
    if (aiLogError) {
      console.error("Erro ao registrar log de IA:", aiLogError);
    }
    const totalTime = Date.now() - startTime;
    console.log(`Post V2 gerado com sucesso: ${post.id} (${totalTime}ms) imageQueued=${!!imageBgOpts}`);
    if (imageBgOpts && post?.id) {
      try {
        EdgeRuntime.waitUntil(generateAndAttachImage(supabase, { postId: post.id, ...imageBgOpts }));
      } catch (bgErr) {
        console.error("Falha ao agendar gera\xE7\xE3o de imagem em background:", bgErr);
      }
    }
    return jsonSuccess({
      success: true,
      post,
      message: imageBgOpts ? "Artigo gerado! Imagem sendo processada em segundo plano." : "Artigo gerado com sucesso!",
      imageQueued: !!imageBgOpts,
      processingTimeMs: totalTime
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Erro em generate-blog-post-v2 (${totalTime}ms):`, error);
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError("Opera\xE7\xE3o cancelada por timeout. Tente novamente.", 504);
    }
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido", 500);
  }
});
