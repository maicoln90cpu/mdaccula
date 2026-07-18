// supabase/functions/generate-multi-event-article/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// supabase/functions/generate-multi-event-article/index.ts
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
var IMAGE_STYLE_PROMPTS = [
  `Crie uma imagem FOTORREALISTA e CINEMATOGR\xC1FICA para um artigo sobre m\xFAsica eletr\xF4nica.
CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}
ESTILO: Fotorrealismo cinematogr\xE1fico \u2014 profundidade de campo rasa, ilumina\xE7\xE3o dram\xE1tica, contraste forte, composi\xE7\xE3o em regra dos ter\xE7os, aspecto editorial.
EVITE: imagens gen\xE9ricas de boates, DJs de costas, multid\xF5es gen\xE9ricas. N\xC3O inclua texto.`,
  `Crie uma imagem com est\xE9tica NEON CYBERPUNK para um artigo sobre m\xFAsica eletr\xF4nica.
CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}
ESTILO: Neon cyberpunk \u2014 cores neon vibrantes, gradientes intensos, est\xE9tica futurista urbana, atmosfera noturna com neblina colorida, reflexos em superf\xEDcies molhadas.
EVITE: imagens flat, cenas diurnas. N\xC3O inclua texto.`,
  `Crie uma ILUSTRA\xC7\xC3O ART\xCDSTICA estilo pintura digital para um artigo sobre m\xFAsica eletr\xF4nica.
CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}
ESTILO: Pintura digital \u2014 texturas pict\xF3ricas vis\xEDveis, paleta expressiva, pinceladas com energia, mistura de realismo com abstra\xE7\xE3o, composi\xE7\xE3o expressionista.
EVITE: fotorrealismo, renderiza\xE7\xE3o 3D limpa. N\xC3O inclua texto.`,
  `Crie uma imagem MINIMALISTA e ABSTRATA para um artigo sobre m\xFAsica eletr\xF4nica.
CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}
ESTILO: Minimalismo abstrato \u2014 formas geom\xE9tricas limpas, paleta reduzida (3-4 cores), espa\xE7o negativo generoso, gradientes suaves, composi\xE7\xE3o sofisticada.
EVITE: excesso de detalhes, fotorrealismo. N\xC3O inclua texto.`,
  `Crie uma imagem estilo COLAGEM EDITORIAL / MIXED MEDIA para um artigo sobre m\xFAsica eletr\xF4nica.
CONTEXTO: "{{title}}" \u2014 {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}
ESTILO: Colagem editorial \u2014 sobreposi\xE7\xE3o de camadas e texturas, mistura de fotografia com gr\xE1ficos, est\xE9tica de zine underground, texturas grunge/halftone, composi\xE7\xE3o desconstru\xEDda.
EVITE: imagens limpas demais, simetria perfeita. N\xC3O inclua texto.`
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
function extractKeywords(content) {
  if (!content) return "";
  const stopwords = /* @__PURE__ */ new Set(["de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "para", "com", "por", "que", "uma", "um", "os", "as", "se", "ou", "mais"]);
  const words = content.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g, " ").split(/\s+/).filter((w) => w.length > 4 && !stopwords.has(w));
  const freq = {};
  words.forEach((w) => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w).join(", ");
}
function inferMood(content, title) {
  const text = (content + " " + title).toLowerCase();
  if (text.includes("festival") || text.includes("celebra")) return "celebrat\xF3rio";
  if (text.includes("underground") || text.includes("techno")) return "underground";
  if (text.includes("futuro") || text.includes("tecnologia")) return "futurista";
  if (text.includes("experimental") || text.includes("vanguarda")) return "experimental";
  return "energ\xE9tico";
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
var FUNCTION_TIMEOUT_MS = 12e4;
async function fetchWithTimeout(url, options, timeoutMs) {
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
function formatDatePt(dateStr) {
  const date = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  const days = ["Domingo", "Segunda", "Ter\xE7a", "Quarta", "Quinta", "Sexta", "S\xE1bado"];
  const months = [
    "Janeiro",
    "Fevereiro",
    "Mar\xE7o",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} (${days[date.getDay()]})`;
}
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { eventIds, seriesName, additionalContext, generateImage, customImageUrl, existingPostId } = body;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length < 2) {
      return jsonError("\xC9 necess\xE1rio selecionar pelo menos 2 eventos", 400);
    }
    if (!seriesName || typeof seriesName !== "string" || !seriesName.trim()) {
      return jsonError("Nome da s\xE9rie \xE9 obrigat\xF3rio", 400);
    }
    const isRegeneration = !!existingPostId;
    console.log("[generate-multi-event-article] Iniciando para:", {
      seriesName,
      eventCount: eventIds.length,
      eventIds,
      isRegeneration,
      existingPostId
    });
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError("Configura\xE7\xE3o de ambiente incompleta", 500);
    }
    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      return jsonError("Nenhuma API key de IA configurada", 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: events, error: eventsError } = await supabase.from("events").select("*").in("id", eventIds).order("date", { ascending: true });
    if (eventsError) {
      throw new Error(`Erro ao buscar eventos: ${eventsError.message}`);
    }
    if (!events || events.length === 0) {
      return jsonError("Nenhum evento encontrado com os IDs fornecidos", 404);
    }
    console.log(`[generate-multi-event-article] ${events.length} eventos encontrados`);
    logEgress(supabase, "events", events);
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const commonVenue = firstEvent.venue;
    const commonCity = firstEvent.location_city;
    const commonState = firstEvent.location_state;
    const allGenres = [...new Set(events.flatMap((e) => e.genres || []))];
    const existingImageUrl = customImageUrl || events.find((e) => e.image_url)?.image_url || null;
    const datesInfo = events.map((event) => {
      const lineupStr = event.lineup && event.lineup.length > 0 ? event.lineup.join(", ") : "A confirmar";
      return `
\u{1F4C5} ${formatDatePt(event.date)} - in\xEDcio ${event.time}${event.end_time ? ` at\xE9 ${event.end_time}` : ""}
\u{1F4CD} Local: ${event.venue}${event.address ? `, ${event.address}` : ""} - ${event.location_city}/${event.location_state}
${event.subtitle ? `\u{1F3F7}\uFE0F Subt\xEDtulo/Promo\xE7\xE3o: ${event.subtitle}` : ""}
\u{1F3A7} Line-up: ${lineupStr}
\u{1F3B5} G\xEAneros: ${(event.genres || []).join(", ") || "M\xFAsica Eletr\xF4nica"}
${event.ticket_link ? `\u{1F39F}\uFE0F Ingressos: ${event.ticket_link}` : ""}
${event.vip_link ? `\u{1F48E} VIP/Camarote: ${event.vip_link}` : ""}
${event.description ? `\u{1F4DD} Descri\xE7\xE3o: ${event.description}` : ""}
${event.ai_context ? `\u{1F3AF} Contexto admin: ${event.ai_context}` : ""}`.trim();
    }).join("\n\n");
    const aggregatedAiCtx = events.map((e) => e.ai_context || "").join(" ").toLowerCase();
    const isCourtesy = /\b(cortesia|free|gratuito|gratuita|sem venda|sem ingresso|guest list|lista de convidados|open list)\b/.test(aggregatedAiCtx);
    const anyLineup = events.some((e) => e.lineup && e.lineup.length > 0);
    const anyEndTime = events.some((e) => e.end_time);
    const anyAddress = events.some((e) => e.address);
    const { data: settings } = await supabase.from("site_settings").select("key, value").in("key", ["ai_blog_model", "ai_temperature"]);
    const settingsMap = {};
    settings?.forEach((s) => {
      settingsMap[s.key] = s.value || "";
    });
    const selectedModel = settingsMap["ai_blog_model"] || "google/gemini-2.5-flash";
    const temperature = parseFloat(settingsMap["ai_temperature"] || "0.9");
    const { data: template } = await supabase.from("ai_prompt_templates").select("system_prompt, user_prompt_template").eq("category", "Multi-Eventos").eq("enabled", true).eq("is_default", true).maybeSingle();
    const defaultSystemPrompt = `Voc\xEA \xE9 um jornalista renomado especializado em m\xFAsica eletr\xF4nica brasileira e internacional, escrevendo para um p\xFAblico apaixonado pela cena underground e pelos grandes eventos.

ESTILO EDITORIAL:
- Tom entusiasmado, vibrante e profissional
- Linguagem rica e descritiva que transporta o leitor para a experi\xEAncia
- Conhecimento profundo da cena eletr\xF4nica e seus artistas
- Portugu\xEAs brasileiro fluido e envolvente

ESTRUTURA OBRIGAT\xD3RIA (JSON):
{
  "title": "T\xEDtulo chamativo e SEO-friendly (m\xE1x 70 caracteres)",
  "excerpt": "Resumo que gere curiosidade (m\xE1x 160 caracteres)",
  "content": "Artigo HTML completo (1500-2500 palavras)",
  "category": "Eventos"
}

FORMATA\xC7\xC3O HTML:
- <h2> para se\xE7\xF5es principais
- <h3> para cada data/evento individual
- <p> para par\xE1grafos descritivos
- <strong> para destaques importantes
- <a href="URL" target="_blank"> para links de ingressos
- <ul><li> para listas quando apropriado

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou explica\xE7\xF5es
- Inclua TODOS os links de ingressos fornecidos de forma natural
- Use dados reais fornecidos, nunca invente informa\xE7\xF5es

\u{1F6A8} REGRA CR\xCDTICA \u2014 DADOS DO PROMPT T\xCAM PRIORIDADE ABSOLUTA:
- Use EXCLUSIVAMENTE os dados fornecidos no prompt (local, venue, endere\xE7o, datas, hor\xE1rios).
- N\xC3O use conhecimento pr\xE9vio ou de treinamento sobre locais, datas ou venues de eventos.
- Se o local informado no prompt difere do que voc\xEA conhece sobre o evento, USE O INFORMADO NO PROMPT.
- O campo "description" do evento pode conter informa\xE7\xF5es desatualizadas \u2014 em caso de conflito entre "description" e os campos estruturados (venue, address, date, time), PRIORIZE os campos estruturados.
- Gere um t\xEDtulo NOVO baseado nos dados atuais, n\xE3o reutilize t\xEDtulos anteriores.`;
    const defaultUserPromptTemplate = `Escreva um artigo COMPLETO e EXTENSO sobre a s\xE9rie de eventos "{{seriesName}}":

\u{1F4CD} LOCAL: {{venue}}, {{city}} - {{state}}
\u{1F4C5} PER\xCDODO: {{startDate}} a {{endDate}}
\u{1F3B5} G\xCANEROS: {{genres}}

---

## PROGRAMA\xC7\xC3O DETALHADA:
{{dates}}

---

{{additionalContext}}

---

## INSTRU\xC7\xD5ES ESPEC\xCDFICAS:

### INTRODU\xC7\xC3O (3-4 par\xE1grafos extensos):
1. Apresente a s\xE9rie "{{seriesName}}" como um acontecimento imperd\xEDvel
2. Fale sobre a HIST\xD3RIA e REPUTA\xC7\xC3O da produtora/label organizadora
3. Descreva o LOCAL em detalhes - atmosfera, estrutura, por que \xE9 especial
4. Contextualize o per\xEDodo (Carnaval, ver\xE3o, etc) e a relev\xE2ncia para a cena

### CADA DATA/EVENTO (m\xEDnimo 5-6 linhas por dia):
Para CADA data, crie uma se\xE7\xE3o <h3> incluindo:
1. Data formatada em destaque
2. Contexto sobre os artistas PRINCIPAIS - quem s\xE3o, de onde v\xEAm, estilo
3. Por que esse lineup \xE9 especial ou imperd\xEDvel
4. Sets esperados, hor\xE1rios (se dispon\xEDveis)
5. Link de ingressos em destaque com call-to-action
6. Men\xE7\xE3o aos artistas de apoio

### ARTISTAS EM DESTAQUE:
Para artistas mais famosos/headliners, inclua:
- Origem e trajet\xF3ria resumida
- Releases ou sets marcantes
- Por que a apresenta\xE7\xE3o ser\xE1 especial
- Contexto de apresenta\xE7\xF5es anteriores no Brasil (se relevante)

### CONCLUS\xC3O:
1. Resumo geral de por que n\xE3o perder a s\xE9rie
2. Dica para quem quer aproveitar todas as datas
3. Informa\xE7\xF5es pr\xE1ticas (local, como chegar)
4. Call-to-action final com link para ingressos

### TAMANHO: 1500-2500 palavras

Retorne APENAS o JSON v\xE1lido.`;
    const baseSystemPrompt = template?.system_prompt || defaultSystemPrompt;
    const userPromptTemplate = template?.user_prompt_template || defaultUserPromptTemplate;
    let userPrompt = userPromptTemplate.replace(/\{\{seriesName\}\}/g, seriesName).replace(/\{\{venue\}\}/g, commonVenue).replace(/\{\{city\}\}/g, commonCity).replace(/\{\{state\}\}/g, commonState).replace(/\{\{startDate\}\}/g, formatDatePt(firstEvent.date)).replace(/\{\{endDate\}\}/g, formatDatePt(lastEvent.date)).replace(/\{\{genres\}\}/g, allGenres.join(", ") || "M\xFAsica Eletr\xF4nica").replace(/\{\{dates\}\}/g, datesInfo).replace(/\{\{additionalContext\}\}/g, additionalContext ? `## CONTEXTO ADICIONAL:
${additionalContext}` : "");
    const officialBlock = `\u{1F4CB} DADOS OFICIAIS DA S\xC9RIE (use literalmente, NUNCA invente, NUNCA contradiga):
- S\xE9rie: ${seriesName}
- Local comum: ${commonVenue}, ${commonCity}/${commonState}
- Per\xEDodo: ${formatDatePt(firstEvent.date)} a ${formatDatePt(lastEvent.date)}
- G\xEAneros: ${allGenres.join(", ") || "M\xFAsica Eletr\xF4nica"}

PROGRAMA\xC7\xC3O POR DATA:
${datesInfo}

\u26A0\uFE0F Se algum dado acima estiver presente, ele DEVE aparecer no artigo. N\xE3o escreva "a confirmar" para informa\xE7\xF5es que constam aqui.

`;
    userPrompt = officialBlock + userPrompt;
    const systemPrompt = baseSystemPrompt + `

\u{1F6A8} HIERARQUIA DE PRIORIDADE (ordem absoluta):
1. Contexto admin de cada evento ("Contexto admin" no bloco oficial)
2. DADOS OFICIAIS DA S\xC9RIE / PROGRAMA\xC7\xC3O POR DATA
3. Template
4. Conhecimento pr\xE9vio (apenas para complementar, nunca para contradizer)

\u{1F6A8} ANTI-HEDGING (proibido "a confirmar" quando o dado existe):
${anyLineup ? '- Lineups foram fornecidos por data: liste exatamente os artistas, NUNCA escreva "lineup a confirmar".' : ""}
${anyEndTime ? '- Hor\xE1rios de t\xE9rmino foram fornecidos: mencione "at\xE9 XX:XX" nas datas correspondentes.' : ""}
${anyAddress ? "- Endere\xE7os foram fornecidos: inclua-os." : ""}
- Use SEMPRE o dia da semana exato que aparece no bloco oficial.
- NUNCA invente venues, datas, lineup ou hor\xE1rios.

\u{1F6A8} LINKS / CUPOM:
${isCourtesy ? `- \u26A0\uFE0F H\xC1 INDICA\xC7\xC3O DE CORTESIA / SEM VENDA em ao menos uma noite (ver "Contexto admin").
- N\xC3O mencione cupom MDACCULA para essas datas.
- Trate links dessas noites como "confirma\xE7\xE3o de presen\xE7a / lista", n\xE3o compra.
- Para datas SEM indica\xE7\xE3o de cortesia, comportamento normal de venda se aplica.` : `- Inclua os links de ingressos REAIS fornecidos por data quando existirem.
- NUNCA invente URLs de ingressos.`}

\u{1F3AC} REGRAS OBRIGAT\xD3RIAS PARA O T\xCDTULO (campo "title" do JSON):
O t\xEDtulo precisa ser EDITORIAL, envolvente e chamativo \u2014 manchete de revista. NUNCA \xE9 apenas concatena\xE7\xE3o de nomes/datas.

PROIBIDO:
- Emojis, separadores " | " " \u2014 " " - " entre nome/data/local
- Datas no formato "DD/MM" ou "DD/MM/AAAA"
- Listar todos os eventos em sequ\xEAncia ("Festa A, Festa B e Festa C")
- Come\xE7ar com "Confira", "N\xE3o perca", "Tudo sobre"

OBRIGAT\xD3RIO:
- 50 a 80 caracteres
- Capturar o fio condutor da sele\xE7\xE3o (ex: "cinco festas que dominam SP nesta semana", "agenda de techno do fim de semana", "noites quentes de maio")
- Voz ativa, sugerindo atmosfera
- Pode usar express\xE3o temporal natural ("nesta semana", "neste fim de semana", "em maio")
- Apenas fatos reais dos DADOS OFICIAIS

\u274C EXEMPLOS RUINS: "Eventos | 15/05, 16/05, 17/05 | SP", "Confira a agenda da semana"
\u2705 EXEMPLOS BONS: "Cinco noites que tomam S\xE3o Paulo neste fim de semana", "Agenda eletr\xF4nica de maio: do techno ao psytrance em SP"
${EDITORIAL_QUALITY_BLOCK}
`;
    console.log("[generate-multi-event-article] Usando template:", template ? "do banco" : "fallback padr\xE3o", "| isCourtesy:", isCourtesy);
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
    console.log(`[generate-multi-event-article] Enviando para IA (${modelName} via ${isOpenAIModel ? "OpenAI direto" : "Lovable Gateway"})...`);
    const isGpt5 = isOpenAIModel && modelName.startsWith("gpt-5");
    const aiResponse = await fetchWithTimeout(apiEndpoint, {
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
    }, 9e4);
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro na API Lovable AI:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return jsonError("Limite de requisi\xE7\xF5es excedido. Tente em alguns minutos.", 429);
      }
      if (aiResponse.status === 402) {
        return jsonError("Cr\xE9ditos insuficientes. Adicione em Settings \u2192 Workspace \u2192 Usage.", 402);
      }
      throw new Error(`Erro na API: ${aiResponse.status}`);
    }
    const aiData = await aiResponse.json();
    let generatedContent = aiData.choices?.[0]?.message?.content;
    const usage = aiData.usage || {};
    if (!generatedContent) {
      throw new Error("IA n\xE3o retornou conte\xFAdo");
    }
    console.log("[generate-multi-event-article] Conte\xFAdo recebido, parseando...");
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
      console.error("Conte\xFAdo recebido:", generatedContent.substring(0, 500));
      throw new Error("IA n\xE3o retornou JSON v\xE1lido");
    }
    if (!articleData.title || !articleData.content) {
      throw new Error("IA n\xE3o gerou dados completos");
    }
    const titleCheck = validateTitle(articleData.title);
    if (!titleCheck.valid) {
      console.warn("[generate-multi-event-article] T\xEDtulo com issues:", titleCheck.issues, "| original:", articleData.title);
    }
    articleData.title = sanitizeTitle(titleCheck.cleaned);
    let finalImageUrl = existingImageUrl;
    let imageTokensUsed = 0;
    const timeForImage = FUNCTION_TIMEOUT_MS - (Date.now() - startTime);
    if (generateImage && !finalImageUrl && !isRegeneration && timeForImage > 35e3) {
      try {
        console.log("[generate-multi-event-article] Gerando imagem com estilo variado...");
        const imgKeywords = extractKeywords(articleData.content || "");
        const imgMood = inferMood(articleData.content || "", seriesName);
        const style = await pickRandomStyle(supabase);
        const imagePrompt = style.prompt.replace(/\{\{title\}\}/g, seriesName).replace(/\{\{summary\}\}/g, articleData.excerpt || "").replace(/\{\{category\}\}/g, "Eventos").replace(/\{\{keywords\}\}/g, imgKeywords).replace(/\{\{mood\}\}/g, imgMood).replace(/\{\{visualElements\}\}/g, `${commonVenue}, ${commonCity}, ${allGenres.join(", ")}`);
        const imageResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"]
          })
        }, 4e4);
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (imageData.usage) {
            imageTokensUsed = imageData.usage.total_tokens || 0;
          }
          if (base64Image) {
            const base64Data = base64Image.split(",")[1];
            const pngBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
            let fileExt = "png";
            let contentType = "image/png";
            if (pngBuffer.length > 12) {
              if (pngBuffer[0] === 82 && pngBuffer[1] === 73 && pngBuffer[2] === 70 && pngBuffer[3] === 70 && pngBuffer[8] === 87 && pngBuffer[9] === 69 && pngBuffer[10] === 66 && pngBuffer[11] === 80) {
                fileExt = "webp";
                contentType = "image/webp";
              } else if (pngBuffer[0] === 255 && pngBuffer[1] === 216) {
                fileExt = "jpg";
                contentType = "image/jpeg";
              }
            }
            const fileName = `multi-event-${Date.now()}.${fileExt}`;
            const BUNNY_STORAGE_API_KEY = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, "")?.replace(/[^\x20-\x7E]/g, "");
            if (BUNNY_STORAGE_API_KEY) {
              const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
              const bunnyUploadUrl = `https://${bunnyHostname}/mdaccula/event-images/${fileName}`;
              const uploadResp = await fetch(bunnyUploadUrl, {
                method: "PUT",
                headers: {
                  AccessKey: BUNNY_STORAGE_API_KEY,
                  "Content-Type": contentType
                },
                body: pngBuffer
              });
              if (uploadResp.ok) {
                finalImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
                console.log("[generate-multi-event-article] Imagem Bunny:", finalImageUrl);
              } else {
                console.error("[generate-multi-event-article] Erro upload Bunny:", await uploadResp.text());
              }
            }
          }
        }
      } catch (imageError) {
        console.error("[generate-multi-event-article] Erro na gera\xE7\xE3o de imagem:", imageError);
      }
    }
    let post;
    if (isRegeneration && existingPostId) {
      console.log("[generate-multi-event-article] Atualizando post existente:", existingPostId);
      const { data: updatedPost, error: updateError } = await supabase.from("blog_posts").update({
        title: articleData.title,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category: articleData.category || "Eventos",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", existingPostId).select().single();
      if (updateError) {
        console.error("Erro ao atualizar post:", updateError);
        throw updateError;
      }
      post = updatedPost;
      console.log("[generate-multi-event-article] Post atualizado:", post.id);
    } else {
      const baseSlug = articleData.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
      const { data: newPost, error: insertError } = await supabase.from("blog_posts").insert({
        title: articleData.title,
        slug,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category: articleData.category || "Eventos",
        published: true,
        published_at: (/* @__PURE__ */ new Date()).toISOString(),
        image_url: finalImageUrl
      }).select().single();
      if (insertError) {
        console.error("Erro ao salvar post:", insertError);
        throw insertError;
      }
      post = newPost;
      console.log("[generate-multi-event-article] Post criado:", post.id);
      const { error: updateEventsError } = await supabase.from("events").update({ blog_post_id: post.id }).in("id", eventIds);
      if (updateEventsError) {
        console.error("Erro ao vincular eventos:", updateEventsError);
      } else {
        console.log(`[generate-multi-event-article] ${eventIds.length} eventos vinculados ao post`);
      }
    }
    const { error: aiLogError } = await supabase.from("ai_generated_posts").insert({
      blog_post_id: post.id,
      prompt_used: `Multi-Event Article${isRegeneration ? " (Regenerated)" : ""}: ${seriesName} (${events.length} eventos)`,
      model_used: selectedModel,
      input_tokens: usage.prompt_tokens || null,
      output_tokens: usage.completion_tokens || null,
      total_tokens: usage.total_tokens || null,
      image_tokens: imageTokensUsed > 0 ? imageTokensUsed : null
    });
    if (aiLogError) {
      console.error("Erro ao registrar log de IA:", aiLogError);
    }
    const totalTime = Date.now() - startTime;
    console.log(`[generate-multi-event-article] Conclu\xEDdo em ${totalTime}ms`);
    return jsonSuccess({
      success: true,
      post,
      linkedEvents: eventIds.length,
      message: isRegeneration ? `Artigo regenerado com sucesso!` : `Artigo consolidado gerado para ${events.length} eventos!`,
      processingTimeMs: totalTime
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Erro em generate-multi-event-article (${totalTime}ms):`, error);
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError("Opera\xE7\xE3o cancelada por timeout. Tente novamente.", 504);
    }
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido", 500);
  }
});
