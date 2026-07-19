import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { sanitizeTitle, validateTitle } from "../_shared/titleSanitizer.ts";
import { EDITORIAL_QUALITY_BLOCK } from "../_shared/editorialQuality.ts";
import { shouldScrapeForContext } from "../_shared/scrapeGate.ts";
import { searchWithFirecrawl } from "../_shared/firecrawlSearch.ts";
import { shouldRequireSourceVerification, buildGuardrailSearchQuery } from "../_shared/eventSourceGuardrail.ts";

// ============= EGRESS TRACKING HELPER =============
function logEgress(supabase: ReturnType<typeof createClient>, apiPath: string, data: unknown) {
  try {
    const bytes = data ? new TextEncoder().encode(JSON.stringify(data)).length : 0;
    const now = new Date();
    now.setMinutes(0, 0, 0);
    supabase.from('egress_metrics').upsert({
      period_start: now.toISOString(),
      api_path: `/rest/v1/${apiPath}`,
      source: 'edge',
      cache_hits: 0,
      cache_misses: 1,
      egress_bytes: bytes,
    }, { onConflict: 'period_start,api_path,source' }).then(() => {}).catch(() => {});
  } catch (_) { /* fire and forget */ }
}

// ============= SHARED UTILITIES =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

function jsonSuccess(data: Record<string, unknown> = { success: true }, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
// ============= END SHARED UTILITIES =============

// ============= CONTENT ANALYSIS HELPERS =============
function extractKeywords(content: string): string {
  if (!content) return '';
  const stopwords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'por',
    'que', 'uma', 'um', 'os', 'as', 'se', 'ou', 'mais', 'isso', 'esse', 'essa', 'este',
    'esta', 'como', 'sua', 'seu', 'seus', 'suas', 'ele', 'ela', 'eles', 'elas', 'foi',
    'são', 'tem', 'ter', 'será', 'sobre', 'entre', 'quando', 'muito', 'também', 'onde',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'are', 'was'
  ]);
  const words = content.toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w));
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
    .join(', ');
}

function inferMood(content: string, title: string): string {
  const text = (content + ' ' + title).toLowerCase();
  if (text.includes('festival') || text.includes('celebra') || text.includes('festa')) return 'celebratório';
  if (text.includes('underground') || text.includes('techno') || text.includes('warehouse')) return 'underground';
  if (text.includes('futuro') || text.includes('tecnologia') || text.includes('ia') || text.includes('digital')) return 'futurista';
  if (text.includes('experimental') || text.includes('vanguarda') || text.includes('inovador')) return 'experimental';
  if (text.includes('clássico') || text.includes('história') || text.includes('vintage')) return 'nostálgico';
  if (text.includes('meditativo') || text.includes('ambient') || text.includes('chill')) return 'introspectivo';
  return 'energético';
}
// ============= END CONTENT ANALYSIS HELPERS =============

const FUNCTION_TIMEOUT_MS = 140000; // 140 seconds - margem de segurança de 10s

// Fetch with timeout using AbortController
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Função para scrape usando API REST do Firecrawl
async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<{ success: boolean; markdown?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    }, 5000); // 5 second timeout for scraping

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.success && data.data?.markdown) {
      return { success: true, markdown: data.data.markdown };
    }
    
    return { success: false, error: 'No markdown content returned' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Scraping timeout' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============= IMAGE STYLE PROMPTS =============
const IMAGE_STYLE_PROMPTS = [
  // Estilo 0: Fotorrealista cinematográfico
  `Crie uma imagem FOTORREALISTA e CINEMATOGRÁFICA para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Fotorrealismo cinematográfico
- Profundidade de campo rasa (bokeh)
- Iluminação dramática com contraste forte (chiaroscuro)
- Tons quentes e frios em equilíbrio
- Composição em regra dos terços
- Aspecto de fotografia editorial de alta moda ou concert photography
- Referências visuais: Annie Leibovitz, Tim Walker

EVITE: imagens genéricas de boates, DJs de costas, multidões genéricas.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 1: Neon/Cyberpunk
  `Crie uma imagem com estética NEON CYBERPUNK para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Arte digital neon/cyberpunk
- Cores neon vibrantes: magenta, ciano, roxo elétrico, verde neon
- Gradientes intensos e brilho luminoso (glow effects)
- Estética futurista urbana, luzes de LED, reflexos em superfícies molhadas
- Atmosfera noturna com neblina colorida
- Referências visuais: Blade Runner, Tron, arte de Beeple
- Composição dinâmica com linhas de luz

EVITE: imagens flat ou sem profundidade, cenas diurnas.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 2: Ilustração artística / pintura digital
  `Crie uma ILUSTRAÇÃO ARTÍSTICA estilo pintura digital para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Pintura digital / ilustração artística
- Texturas pictóricas visíveis (como pintura a óleo ou aquarela digital)
- Paleta de cores expressiva e ousada
- Pinceladas visíveis que dão energia e movimento
- Mistura de realismo com elementos abstratos
- Referências visuais: concept art, arte de álbum, ilustração editorial
- Composição expressionista com foco emocional

EVITE: fotorrealismo, renderização 3D limpa, imagens flat.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 3: Minimalista abstrato
  `Crie uma imagem MINIMALISTA e ABSTRATA para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Minimalismo abstrato
- Formas geométricas limpas e precisas
- Paleta de cores reduzida (máximo 3-4 cores)
- Muito espaço negativo e respiração visual
- Gradientes suaves e transições elegantes
- Referências visuais: arte de capa da Kompakt, Raster-Noton, design suíço
- Composição equilibrada e sofisticada

EVITE: excesso de detalhes, fotorrealismo, poluição visual.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 4: Colagem editorial / mixed media
  `Crie uma imagem estilo COLAGEM EDITORIAL / MIXED MEDIA para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Colagem editorial e mixed media
- Sobreposição de camadas e texturas diferentes
- Mistura de fotografia com elementos gráficos e tipográficos
- Estética de revista, zine ou poster de evento underground
- Texturas de papel rasgado, grunge, halftone, risograph
- Referências visuais: David Carson, Neville Brody, posters de rave dos anos 90
- Composição desconstruída e energética

EVITE: imagens limpas demais, fotorrealismo puro, simetria perfeita.
NÃO inclua texto, palavras ou números na imagem.`
];

// Função para selecionar estilo aleatório sem repetir o último
async function pickRandomStyle(supabase: ReturnType<typeof createClient>): Promise<{ index: number; prompt: string }> {
  // Buscar último estilo usado
  const { data: setting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'last_image_style_index')
    .maybeSingle();

  const lastIndex = parseInt(setting?.value || '-1', 10);
  
  // Filtrar o último índice e sortear entre os restantes
  const availableIndices = IMAGE_STYLE_PROMPTS.map((_, i) => i).filter(i => i !== lastIndex);
  const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  
  // Salvar novo índice (upsert)
  await supabase
    .from('site_settings')
    .upsert(
      { key: 'last_image_style_index', value: String(nextIndex), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  console.log(`🎨 Estilo de imagem selecionado: ${nextIndex} (último: ${lastIndex})`);
  
  return { index: nextIndex, prompt: IMAGE_STYLE_PROMPTS[nextIndex] };
}
// ============= END IMAGE STYLE PROMPTS =============

// Função para substituir variáveis em texto
function replaceVariables(text: string, fields: Record<string, unknown>): string {
  if (!text) return text;
  let result = text;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      const strValue = String(value);
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), strValue);
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), strValue);
    }
  }
  // Remover placeholders não substituídos
  result = result.replace(/\{\{[a-zA-Z_]+\}\}/g, '');
  result = result.replace(/\{[a-zA-Z_]+\}/g, '');
  return result;
}

// Lista de domínios falsos que a IA costuma inventar
const FAKE_DOMAINS = [
  'ticketlink.com.br',
  'ticketlink.com',
  'ingressos.com',
  'ingressos.com.br',
  'tickets.com.br',
  'tickets.com',
  'example.com',
  'evento.com.br',
  'evento.com',
  'link.com.br',
  'comprar.com.br',
  'bilheteria.com.br',
  'bilheteria.com',
  'eventbrite.fake',
  'sympla.fake',
];

// Restringe um link a UMA única ocorrência no artigo — usado pro link de
// VIP/camarote, que o modelo tende a mencionar em 2-3 seções diferentes
// mesmo com a instrução de prompt pedindo menção única (regra de prompt
// sozinha se mostrou inconsistente; isso garante o resultado).
function restrictLinkToFirstMention(content: string, url: string): string {
  if (!url) return content;
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(`<a[^>]*href=["']${escapedUrl}["'][^>]*>([^<]*)</a>`, 'gi');
  let firstSeen = false;
  return content.replace(linkRegex, (match, innerText) => {
    if (!firstSeen) {
      firstSeen = true;
      return match;
    }
    return innerText;
  });
}

// Função para remover links com domínios inventados pela IA
function removeFakeLinks(content: string): string {
  let cleaned = content;
  for (const domain of FAKE_DOMAINS) {
    // Remover links <a> com domínios fake
    const linkRegex = new RegExp(
      `<a[^>]*href=['"](?:https?://)?(?:www\\.)?${domain.replace(/\./g, '\\.')}[^'"]*['"][^>]*>[^<]*</a>`,
      'gi'
    );
    cleaned = cleaned.replace(linkRegex, '');
    
    // Remover URLs em texto plain também (ex: www.ticketlink.com.br)
    const plainUrlRegex = new RegExp(
      `(?:https?://)?(?:www\\.)?${domain.replace(/\./g, '\\.')}[^\\s<]*`,
      'gi'
    );
    cleaned = cleaned.replace(plainUrlRegex, '');
  }
  
  // Limpar parágrafos vazios resultantes
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned.trim();
}

// ============= BACKGROUND IMAGE GENERATION =============
// Gera imagem da capa em segundo plano (após o post já estar salvo).
// Não bloqueia a resposta da edge function — disparado via EdgeRuntime.waitUntil.
interface BackgroundImageOpts {
  postId: string;
  imageTitle: string;
  imageSummary: string;
  imageCategory: string;
  imageKeywords: string;
  imageMood: string;
  imageVisualElements: string;
  customImagePrompt: string;
  lovableApiKey: string;
}

async function generateAndAttachImage(
  supabase: ReturnType<typeof createClient>,
  opts: BackgroundImageOpts
): Promise<void> {
  const bgStart = Date.now();
  const MAX_IMAGE_ATTEMPTS = 2;
  const IMAGE_BUDGET_MS = 90000; // 90s budget total para o background

  try {
    for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
      if (Date.now() - bgStart > IMAGE_BUDGET_MS) {
        console.warn(`[bg-image] Budget esgotado antes da tentativa ${attempt}`);
        break;
      }

      try {
        console.log(`[bg-image] 🎨 Tentativa ${attempt}/${MAX_IMAGE_ATTEMPTS} para post ${opts.postId}`);

        let selectedPromptTemplate: string;
        if (opts.customImagePrompt) {
          selectedPromptTemplate = opts.customImagePrompt;
        } else {
          const style = await pickRandomStyle(supabase);
          selectedPromptTemplate = style.prompt;
          console.log(`[bg-image] Estilo variado #${style.index}`);
        }

        const imagePrompt = selectedPromptTemplate
          .replace(/\{\{title\}\}/g, opts.imageTitle)
          .replace(/\{\{summary\}\}/g, opts.imageSummary)
          .replace(/\{\{category\}\}/g, opts.imageCategory)
          .replace(/\{\{keywords\}\}/g, opts.imageKeywords)
          .replace(/\{\{mood\}\}/g, opts.imageMood)
          .replace(/\{\{visualElements\}\}/g, opts.imageVisualElements);

        const imageTimeout = 45000;
        const imageResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${opts.lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image',
            messages: [{ role: 'user', content: imagePrompt }],
            modalities: ['image', 'text']
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

        const base64Data = base64Image.split(',')[1];
        if (!base64Data || base64Data.length < 1024) {
          console.error(`[bg-image] Tentativa ${attempt}: base64 muito pequeno`);
          continue;
        }

        const pngBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        if (pngBuffer.length < 1024) {
          console.error(`[bg-image] Tentativa ${attempt}: buffer pequeno`);
          continue;
        }

        let finalBuffer: Uint8Array;
        let fileExt = 'png';
        let contentType = 'image/png';
        try {
          const image = await Image.decode(pngBuffer);
          const maxDimension = 1024;
          if (image.width > maxDimension || image.height > maxDimension) {
            const scale = maxDimension / Math.max(image.width, image.height);
            image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
          }
          finalBuffer = await image.encodeWEBP(85);
          fileExt = 'webp';
          contentType = 'image/webp';
        } catch (conversionError) {
          console.error('[bg-image] Falha WebP, usando PNG:', conversionError);
          finalBuffer = pngBuffer;
        }

        const fileName = `ai-generated-${Date.now()}.${fileExt}`;
        const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY')?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');

        if (!BUNNY_STORAGE_API_KEY) {
          console.error('[bg-image] BUNNY_STORAGE_API_KEY ausente');
          break;
        }

        const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
        const bunnyUploadUrl = `https://${bunnyHostname}/mdaccula/event-images/${fileName}`;
        const uploadResp = await fetch(bunnyUploadUrl, {
          method: 'PUT',
          headers: { AccessKey: BUNNY_STORAGE_API_KEY, 'Content-Type': contentType },
          body: finalBuffer,
        });

        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          console.error(`[bg-image] Upload Bunny falhou (${uploadResp.status}):`, errText);
          continue;
        }

        const generatedImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
        console.log(`[bg-image] ✅ Upload OK: ${generatedImageUrl}`);

        const { error: updateErr } = await supabase
          .from('blog_posts')
          .update({ image_url: generatedImageUrl })
          .eq('id', opts.postId);

        if (updateErr) {
          console.error('[bg-image] Erro ao atualizar blog_posts.image_url:', updateErr);
        } else {
          console.log(`[bg-image] ✅ Post ${opts.postId} atualizado com capa em ${Date.now() - bgStart}ms`);
        }

        if (imageTokensUsed > 0) {
          await supabase
            .from('ai_generated_posts')
            .update({ image_tokens: imageTokensUsed })
            .eq('blog_post_id', opts.postId)
            .then(() => {})
            .catch(() => {});
        }

        return; // sucesso, sair
      } catch (innerErr) {
        console.error(`[bg-image] Erro tentativa ${attempt}:`, innerErr);
      }
    }
    console.warn(`[bg-image] ⚠️ Todas as tentativas falharam para post ${opts.postId}`);
  } catch (outerErr) {
    console.error('[bg-image] Erro fatal no background:', outerErr);
  }
}
// ============= END BACKGROUND IMAGE GENERATION =============

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { templateId, generateImage, publishImmediately, ...formFields } = body;

    // Logging dos campos recebidos para debug
    console.log('[generate-blog-post-v2] Campos recebidos:', JSON.stringify(Object.keys(formFields)));
    console.log('[generate-blog-post-v2] Valores principais:', JSON.stringify({
      eventName: formFields.eventName,
      title: formFields.title,
      eventDate: formFields.eventDate,
      venue: formFields.venue,
      lineup: formFields.lineup,
      ticketLink: formFields.ticketLink
    }));

    // Validar campos obrigatórios
    const eventName = formFields.eventName || formFields.title;
    if (!eventName) {
      return jsonError('Nome do evento (eventName ou title) é obrigatório para gerar o artigo', 400);
    }

    // Compor eventLocation se não vier pronto (fallback)
    // Dedup case-insensitive: evita "São Paulo - São Paulo - SP" quando o
    // venue foi cadastrado com o nome da cidade em vez de um local específico.
    if (!formFields.eventLocation && (formFields.venue || formFields.locationCity)) {
      const seenParts = new Set<string>();
      formFields.eventLocation = [
        formFields.venue,
        formFields.locationCity,
        formFields.locationState
      ]
        .filter((part): part is string => {
          if (!part) return false;
          const key = String(part).trim().toLowerCase();
          if (seenParts.has(key)) return false;
          seenParts.add(key);
          return true;
        })
        .join(' - ');
      console.log('[generate-blog-post-v2] eventLocation composto:', formFields.eventLocation);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError('Configuração de ambiente incompleta', 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar configurações de IA do site_settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['ai_blog_model', 'ai_temperature', 'ai_image_prompt_template', 'ai_max_scrape_sources', 'ai_max_article_length']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });
    logEgress(supabase, 'site_settings', settings);

    const selectedModel = settingsMap['ai_blog_model'] || 'google/gemini-2.5-flash';
    const temperature = parseFloat(settingsMap['ai_temperature'] || '0.9');
    const customImagePrompt = settingsMap['ai_image_prompt_template'] || '';
    const maxScrapeSources = parseInt(settingsMap['ai_max_scrape_sources'] || '2');
    const maxArticleLength = parseInt(settingsMap['ai_max_article_length'] || '5000');

    console.log('Configurações carregadas:', { selectedModel, temperature, maxScrapeSources, maxArticleLength });

    // Check remaining time before scraping
    const elapsedMs = Date.now() - startTime;
    const remainingMs = FUNCTION_TIMEOUT_MS - elapsedMs;

    // Buscar fontes de notícias para contexto adicional (scraping)
    // Nota: a geração de imagem roda em background (EdgeRuntime.waitUntil,
    // ver generateAndAttachImage) e não bloqueia mais a resposta de texto,
    // então não há motivo para pular o scraping quando generateImage=true
    // (ver _shared/scrapeGate.ts para o histórico dessa regressão).
    let scrapedContext = '';
    if (FIRECRAWL_API_KEY && shouldScrapeForContext({ hasApiKey: true, remainingMs })) {
      try {
        const { data: sources } = await supabase
          .from('event_sources')
          .select('name, url')
          .eq('enabled', true)
          .limit(maxScrapeSources);

        if (sources && sources.length > 0) {
          logEgress(supabase, 'event_sources', sources);
          console.log('Scraping fontes para contexto adicional...');
          for (const source of sources) {
            // Check if we still have time
            if (Date.now() - startTime > FUNCTION_TIMEOUT_MS - 12000) {
              console.log('Skipping remaining sources due to time constraints');
              break;
            }

            const result = await scrapeWithFirecrawl(source.url, FIRECRAWL_API_KEY);
            if (result.success && result.markdown) {
              const truncated = result.markdown.substring(0, 1500);
              scrapedContext += `\n\n### Contexto de ${source.name}:\n${truncated}`;
              console.log(`✓ Contexto obtido de ${source.name}`);
            }
          }
        }
      } catch (scrapeError) {
        console.log('Scraping opcional falhou, continuando sem contexto adicional');
      }
    }

    // Buscar template (se não fornecido, usa o default)
    let template;
    if (templateId) {
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw new Error(`Template não encontrado: ${error.message}`);
      template = data;
    } else {
      // Buscar template default com categoria "Eventos" para evitar erro de múltiplos defaults
      const { data: defaultTemplates, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('is_default', true)
        .eq('category', 'Eventos')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (error || !defaultTemplates || defaultTemplates.length === 0) {
        // Fallback: pegar qualquer template de eventos habilitado
        console.log('Template default de Eventos não encontrado, buscando fallback...');
        const { data: fallbackTemplates, error: fallbackError } = await supabase
          .from('ai_prompt_templates')
          .select('*')
          .eq('category', 'Eventos')
          .eq('enabled', true)
          .order('created_at', { ascending: true })
          .limit(1);
        
        if (fallbackError || !fallbackTemplates || fallbackTemplates.length === 0) {
          throw new Error('Nenhum template de eventos encontrado no sistema');
        }
        template = fallbackTemplates[0];
        console.log(`Usando template fallback: ${template.name}`);
      } else {
        template = defaultTemplates[0];
        console.log(`Usando template default: ${template.name}`);
      }
    }

    // ===== Helper: weekday em PT-BR a partir de YYYY-MM-DD (defesa em profundidade) =====
    const WEEKDAYS_PT = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    function computeWeekday(dateStr: string): string {
      if (!dateStr || typeof dateStr !== 'string') return '';
      const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return '';
      const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return WEEKDAYS_PT[dt.getDay()] || '';
    }
    function computeDateFormatted(dateStr: string): string {
      const m = dateStr?.match?.(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return dateStr || '';
      const wd = computeWeekday(dateStr);
      return `${Number(m[3])} de ${MONTHS_PT[Number(m[2]) - 1]} de ${m[1]}${wd ? ` (${wd})` : ''}`;
    }

    // Garantir weekday/dateFormatted mesmo quando o caller não envia
    if (formFields.eventDate && !formFields.weekday) {
      formFields.weekday = computeWeekday(String(formFields.eventDate));
    }
    if (formFields.eventDate && !formFields.dateFormatted) {
      formFields.dateFormatted = computeDateFormatted(String(formFields.eventDate));
    }

    // Substituir variáveis no user_prompt_template
    let userPrompt = template.user_prompt_template;
    for (const [key, value] of Object.entries(formFields)) {
      if (value) {
        userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
        userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value as string);
        userPrompt = userPrompt.replace(
          new RegExp(`\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, 'g'),
          '$1'
        );
      } else {
        userPrompt = userPrompt.replace(
          new RegExp(`\\{\\{#if ${key}\\}\\}[\\s\\S]*?\\{\\{/if\\}\\}`, 'g'),
          ''
        );
      }
    }

    // ===== DETECTAR MODO: evento real vs artigo editorial/notícia =====
    // Modo "evento" só liga quando há sinais concretos de evento (data, venue, lineup,
    // horário, endereço) OU quando o template é da categoria Eventos/Festivais.
    // Para sugestões editoriais (Cultura, Tecnologia, Produtores, etc.) NÃO injetamos
    // o bloco "DADOS OFICIAIS" nem as regras anti-hedging de evento — caso contrário
    // a IA força seções "Lineup" / "Local e horário" / "a confirmar" mesmo sem dados.
    const hasEventSignals = Boolean(
      formFields.eventDate || formFields.venue || formFields.lineup ||
      formFields.eventTime || formFields.address || formFields.locationCity
    );
    const templateIsEvent = template.category === 'Eventos' || template.category === 'Festivais';
    const isEventMode = hasEventSignals || templateIsEvent;
    console.log(`[generate-blog-post-v2] Modo: ${isEventMode ? 'EVENTO' : 'EDITORIAL'} | template="${template.name}" (${template.category}) | hasEventSignals=${hasEventSignals}`);

    // ===== GUARDRAIL: modo evento sem nenhum sinal real por trás =====
    // Acontece quando o admin escolhe manualmente um template de categoria Eventos/
    // Festivais (ex.: "Raspagem de Eventos") na aba Gerar e digita só o nome, sem
    // vincular um evento real do banco. Sem isso, o bloco anti-hedging mais abaixo
    // força a IA a "confirmar" lineup/local/horário que ela não tem — e ela inventa
    // (ver R-018 em docs/TESTING.md). Fluxos legítimos (evento real do site via
    // buildArticlePayload, multi-evento, scan-event-sources) sempre chegam aqui com
    // hasEventSignals=true e pulam este bloco inteiro.
    let guardrailSourceUrls: string[] | null = null;
    if (shouldRequireSourceVerification(isEventMode, hasEventSignals)) {
      if (!FIRECRAWL_API_KEY) {
        return jsonError(
          'Este template de evento não tem dados reais associados (data, local, lineup) e a verificação de fontes (FIRECRAWL_API_KEY) não está configurada — geração bloqueada por segurança.',
          500
        );
      }
      const guardrailQuery = buildGuardrailSearchQuery(eventName, formFields.eventLocation);
      console.log(`[generate-blog-post-v2] Modo evento sem sinal real — verificando fonte real para: "${guardrailQuery}"`);
      let guardrailResults;
      try {
        guardrailResults = await searchWithFirecrawl(guardrailQuery, FIRECRAWL_API_KEY, 5, 30000);
      } catch (searchError) {
        console.error('[generate-blog-post-v2] Falha na busca de verificação de fonte:', searchError);
        return jsonError('Não foi possível verificar fontes reais agora (falha na busca). Tente novamente em instantes.', 502);
      }
      if (guardrailResults.length === 0) {
        return jsonError(
          `Nenhuma fonte real encontrada para "${eventName}". Nenhum artigo foi criado — confirme os dados manualmente ou tente um termo mais específico.`,
          404
        );
      }
      guardrailSourceUrls = guardrailResults.map((r) => r.url);
      const guardrailSourcesBlock = guardrailResults
        .map((r, i) => `### Fonte ${i + 1}: ${r.title} (${r.url})\n${r.content}`)
        .join('\n\n---\n\n');
      userPrompt = `\n\n📰 FONTES REAIS ENCONTRADAS (use literalmente pra confirmar lineup/local/horário do evento, NUNCA invente além do que está aqui):\n${guardrailSourcesBlock}\n\n` + userPrompt;
      console.log(`[generate-blog-post-v2] ${guardrailResults.length} fonte(s) real(is) encontrada(s), prosseguindo.`);
    }

    // ===== BLOCO "DADOS OFICIAIS" — só injetado em MODO EVENTO =====
    if (isEventMode) {
      const officialDataLines: string[] = [];
      const pushIf = (label: string, val: unknown) => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          officialDataLines.push(`- ${label}: ${val}`);
        }
      };
      pushIf('Nome do evento', formFields.eventName || formFields.title);
      pushIf('Subtítulo/Promoção', formFields.subtitle);
      pushIf('Data', formFields.dateFormatted || formFields.eventDate);
      pushIf('Dia da semana', formFields.weekday);
      pushIf('Horário de início', formFields.eventTime);
      pushIf('Horário de término', formFields.endTime);
      pushIf('Local', formFields.eventLocation);
      // Se venue e cidade forem a mesma string (evento cadastrado sem venue
      // real, só a cidade), não empurra "Cidade" separadamente — evita o
      // modelo tratar isso como dois fatos distintos ("em São Paulo, na
      // cidade de São Paulo").
      const venueEqualsCity = Boolean(
        formFields.venue && formFields.locationCity &&
        String(formFields.venue).trim().toLowerCase() === String(formFields.locationCity).trim().toLowerCase()
      );
      pushIf('Casa/Venue', formFields.venue);
      pushIf('Endereço', formFields.address);
      if (!venueEqualsCity) {
        pushIf('Cidade', formFields.locationCity);
      }
      pushIf('Estado', formFields.locationState);
      pushIf('Gêneros musicais', formFields.genres);
      pushIf('Lineup confirmado', formFields.lineup);
      pushIf('Link de ingressos', formFields.ticketLink);
      pushIf('Link VIP/camarote', formFields.vipLink);
      pushIf('Descrição oficial', formFields.description);

      if (officialDataLines.length > 0) {
        const officialDataBlock = `\n\n📋 DADOS OFICIAIS DO EVENTO (use literalmente, NUNCA invente, NUNCA contradiga):\n${officialDataLines.join('\n')}\n\n⚠️ Se algum dado acima estiver presente, ele DEVE aparecer no artigo. Não escreva "a confirmar" para informações que constam aqui.\n`;
        userPrompt = officialDataBlock + userPrompt;
      }
    }

    // Log do prompt após substituições
    console.log('[generate-blog-post-v2] User prompt após substituições (preview):', userPrompt.substring(0, 1200));

    // Determinar se há link de ingresso real
    const hasRealTicketLink = formFields.ticketLink && 
      typeof formFields.ticketLink === 'string' && 
      formFields.ticketLink.length > 5 &&
      !FAKE_DOMAINS.some(domain => formFields.ticketLink.includes(domain));

    // Detectar se o aiContext indica cortesia/free → desativa regra de cupom MDACCULA
    const aiCtxLower = String(formFields.aiContext || '').toLowerCase();
    const isCourtesy = /\b(cortesia|free|gratuito|gratuita|sem venda|sem ingresso|guest list|lista de convidados|open list)\b/.test(aiCtxLower);

    // Construir bloco de contexto do admin (aiContext) — vale para qualquer modo
    const aiContextBlock = formFields.aiContext 
      ? `\n\n🎯 INSTRUÇÕES ESPECIAIS DO ADMIN (PRIORIDADE MÁXIMA — respeite literalmente, sobrepõe template e conhecimento prévio):
${formFields.aiContext}`
      : '';

    // ===== Blocos condicionais de evento (anti-hedging, ingressos, cupom) =====
    const eventAntiHedgingBlock = isEventMode ? `

🚨 ANTI-HEDGING (proibido falar "a confirmar" quando o dado existe):
${formFields.lineup ? '- Lineup foi fornecido: NÃO escreva "lineup a confirmar" ou "line-up completo ainda não oficializado". Liste os artistas exatos.' : ''}
${formFields.endTime ? '- Horário de término foi fornecido: mencione-o ("até XX:XX").' : ''}
${formFields.eventTime ? '- Horário de início foi fornecido: mencione-o.' : ''}
${formFields.address ? '- Endereço completo foi fornecido: inclua-o.' : ''}
${formFields.subtitle ? '- Subtítulo/promoção foi fornecido: incorpore essa informação no artigo.' : ''}
${formFields.vipLink ? '- Link VIP foi fornecido: mencione a opção de camarote/VIP em UM ÚNICO ponto do artigo — nunca repita a mesma menção em duas seções diferentes (ex: não repita na conclusão se já mencionou na seção de ingressos). Use um texto de link natural e curto (ex: "reserve sua área VIP", "fale sobre o camarote"). NUNCA copie a frase "área VIP/camarote" literalmente como texto do link.' : ''}
${formFields.weekday ? `- Dia da semana CORRETO é "${formFields.weekday}". NUNCA escreva outro dia da semana.` : ''}

🚨 PRIORIDADE DOS CAMPOS ESTRUTURADOS:
- Em caso de conflito entre "description" e os dados estruturados (venue, eventLocation, eventDate, weekday), PRIORIZE os dados estruturados.
- Não use seu conhecimento de treinamento sobre locais/datas/lineup do evento — use APENAS os DADOS OFICIAIS.` : '';

    const editorialModeBlock = !isEventMode ? `

📰 MODO EDITORIAL/NOTÍCIA (NÃO é evento/festa):
- Este artigo é uma matéria jornalística, opinativa ou de tendências — NÃO é divulgação de festa.
- PROIBIDO criar seções "Lineup", "Local e horário", "Ingressos", "Como chegar".
- PROIBIDO escrever "a confirmar", "lineup a confirmar", "venue a confirmar" — não há evento concreto.
- Estrutura esperada: introdução cativante + 3-4 seções <h3> com análise/contexto + conclusão com perspectiva.
- Cite artistas, labels, faixas, eventos passados ou tecnologias quando relevante para argumentar.
- Foque no tema do título e do resumo. Nunca force o texto para um formato de divulgação de evento.` : '';

    const ticketsBlock = !isEventMode
      ? `\n\n🚨 LINKS E CTA (modo editorial):
- NÃO inclua seção de "Ingressos" nem mencione cupom MDACCULA — não é divulgação de evento.
- NUNCA invente URLs.
- CTA final sugerido: "Acompanhe a MDAccula para mais novidades da cena eletrônica."`
      : isCourtesy
        ? `\n\n🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- ⚠️ ESTE EVENTO É CORTESIA / SEM VENDA DE INGRESSOS (conforme aiContext acima).
- NÃO mencione cupom de desconto MDACCULA.
- NÃO escreva "garanta seu ingresso", "compre antecipado", "lotes" ou similares.
- Se houver link, descreva-o como "link para confirmar presença / lista" e não como compra.
- Ignore qualquer instrução do template que force menção a cupom de desconto.`
        : hasRealTicketLink
          ? `\n\n🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- Link de ingressos REAL fornecido: ${formFields.ticketLink}
- Você PODE incluir seção de ingressos com cupom MDACCULA usando este link.`
          : `\n\n🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- NÃO há link de ingressos fornecido para este artigo.
- NUNCA INVENTE URLs de ingressos como "ticketlink.com.br", "ingressos.com.br", etc.
- NÃO inclua seção de "Ingressos", "Onde comprar" ou "Garanta seu lugar".
- NÃO mencione cupom de desconto MDACCULA se não houver link real.
- Use CTA alternativo: "Acompanhe a MDAccula para mais novidades da cena eletrônica."`;

    // Adicionar instrução de tamanho máximo + regras de título ao system prompt
    const systemPromptWithLength = template.system_prompt + 
      `\n\n🚨 HIERARQUIA DE PRIORIDADE (ordem absoluta):
1. INSTRUÇÕES ESPECIAIS DO ADMIN (aiContext)
2. ${isEventMode ? 'DADOS OFICIAIS DO EVENTO (bloco no user prompt)' : 'Tema do título/resumo da sugestão'}
3. Template
4. Conhecimento prévio (use APENAS para complementar, nunca para contradizer)

IMPORTANTE: 
- O artigo deve ter no máximo ${maxArticleLength} caracteres.
- NUNCA use placeholders como {{eventName}}, {{eventDate}}, {{lineup}}, etc. no texto gerado.
- ${isEventMode ? 'Use os valores REAIS fornecidos no bloco "DADOS OFICIAIS".' : 'Baseie-se no título e resumo fornecidos.'}
- Se um campo NÃO existe nos dados fornecidos, omita — NUNCA invente.${eventAntiHedgingBlock}${editorialModeBlock}
${EDITORIAL_QUALITY_BLOCK}

🎬 REGRAS OBRIGATÓRIAS PARA O TÍTULO (campo "title" do JSON):
O título precisa ser EDITORIAL, envolvente e chamativo — como manchete de revista de música eletrônica.

PROIBIDO no título:
- Emojis (☀️, 👁️, 🎵, ⭐ etc.)
- Separar campos com " | ", " — " ou " - " no estilo "Nome | DD/MM | Cidade"
- Datas no formato "DD/MM/AAAA" ou "DD/MM" (use linguagem temporal natural)
- Começar com "Confira", "Não perca", "Saiba tudo sobre", "Tudo sobre"
- Inventar adjetivos não embasados nos dados

OBRIGATÓRIO no título:
- 50 a 80 caracteres
- Voz ativa, sugerindo clima/atmosfera${formFields.weekday && isEventMode ? ` (dia correto: "${formFields.weekday}")` : ''}
- Sempre baseado em fatos reais — nunca inventar

${aiContextBlock}${ticketsBlock}`;
    
    // Determinar qual API usar baseado no modelo selecionado
    const isOpenAIModel = selectedModel.startsWith('openai/');
    let apiKey: string;
    let apiEndpoint: string;
    let modelName: string;

    if (isOpenAIModel) {
      if (!OPENAI_API_KEY) {
        return jsonError('OPENAI_API_KEY não configurada. Configure em Settings → Secrets.', 500);
      }
      apiKey = OPENAI_API_KEY;
      apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      modelName = selectedModel.replace('openai/', '');
      console.log(`Usando OpenAI API diretamente com modelo: ${modelName}`);
    } else {
      if (!LOVABLE_API_KEY) {
        return jsonError('LOVABLE_API_KEY não configurada', 500);
      }
      apiKey = LOVABLE_API_KEY;
      apiEndpoint = 'https://ai.gateway.lovable.dev/v1/chat/completions';
      modelName = selectedModel;
      console.log(`Usando Lovable AI Gateway com modelo: ${modelName}`);
    }

    console.log("Template usado:", template.name);
    console.log("Gerar imagem:", generateImage);

    // Preparar body da requisição
    const requestBody: Record<string, unknown> = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPromptWithLength + (scrapedContext ? `\n\n## CONTEXTO ADICIONAL DAS FONTES DE NOTÍCIAS:\nUse estas informações reais para enriquecer o artigo:${scrapedContext}` : '') },
        { role: 'user', content: userPrompt }
      ],
    };

    if (selectedModel.startsWith('google/gemini') && !selectedModel.includes('image')) {
      requestBody.temperature = temperature;
      console.log(`Usando temperature ${temperature} para modelo Gemini`);
    } else if (isOpenAIModel && modelName.startsWith('gpt-5')) {
      // Modelos gpt-5* são "reasoning models" e não aceitam temperature customizada.
      // reasoning_effort baixo + verbosity alta reduzem o "achatamento" da prosa
      // em tarefas criativas/editoriais sem custo extra relevante.
      requestBody.reasoning_effort = 'minimal';
      requestBody.verbosity = 'high';
      console.log('Usando reasoning_effort=minimal, verbosity=high para modelo gpt-5*');
    }

    // Imagem agora é gerada em BACKGROUND (após resposta), então o texto pode usar quase
    // todo o budget. Cap fixo em 110s independente de generateImage.
    const elapsedBeforeAI = Date.now() - startTime;
    const aiTextCap = 110000;
    const aiTextTimeout = Math.min(aiTextCap, FUNCTION_TIMEOUT_MS - elapsedBeforeAI - 5000);
    console.log(`⏱️ AI text timeout: ${aiTextTimeout}ms (cap=${aiTextCap}ms, elapsed: ${elapsedBeforeAI}ms, imagem será em background)`);
    
    if (aiTextTimeout < 10000) {
      return jsonError('Tempo insuficiente para geração. Tente novamente.', 504);
    }

    const aiResponse = await fetchWithTimeout(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }, aiTextTimeout);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return jsonError("Limite de requisições excedido. Tente em alguns minutos.", 429);
      }
      
      if (aiResponse.status === 402) {
        return jsonError("Créditos insuficientes. Adicione em Settings → Workspace → Usage.", 402);
      }
      
      throw new Error(`Erro na API: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let generatedContent = aiData.choices?.[0]?.message?.content;
    const usage = aiData.usage || {};

    if (!generatedContent) {
      throw new Error('IA não retornou conteúdo');
    }

    console.log('Conteúdo bruto recebido:', generatedContent);

    // Limpar markdown se houver
    generatedContent = generatedContent.trim();
    if (generatedContent.startsWith('```json')) {
      generatedContent = generatedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (generatedContent.startsWith('```')) {
      generatedContent = generatedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse do JSON
    let eventData;
    try {
      eventData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.error('Conteúdo recebido:', generatedContent);
      throw new Error('IA não retornou JSON válido');
    }

    // Validar estrutura obrigatória
    if (!eventData.title || !eventData.content) {
      throw new Error('IA não gerou dados completos. Tente novamente com mais detalhes.');
    }

    // PÓS-PROCESSAMENTO: Substituir variáveis remanescentes no conteúdo gerado
    console.log('[generate-blog-post-v2] Aplicando pós-processamento de variáveis...');
    eventData.title = replaceVariables(eventData.title, formFields);
    eventData.excerpt = replaceVariables(eventData.excerpt || '', formFields);
    eventData.content = replaceVariables(eventData.content, formFields);

    // Sanitização editorial: remove emojis, prefixos hediondos e reporta separadores/datas
    const titleCheck = validateTitle(eventData.title);
    if (!titleCheck.valid) {
      console.warn('[generate-blog-post-v2] Título com issues:', titleCheck.issues, '| original:', eventData.title);
    }
    eventData.title = sanitizeTitle(titleCheck.cleaned);

    // Substituir placeholders de link de ingresso
    if (formFields.ticketLink && hasRealTicketLink) {
      eventData.content = eventData.content
        .replace(/\[TICKET_LINK\]/g, formFields.ticketLink)
        .replace(/href='LINK'/g, `href='${formFields.ticketLink}'`)
        .replace(/href="LINK"/g, `href="${formFields.ticketLink}"`);
    }

    // PÓS-PROCESSAMENTO: Remover links inventados pela IA
    console.log('[generate-blog-post-v2] Removendo links fake...');
    const contentBefore = eventData.content.length;
    eventData.content = removeFakeLinks(eventData.content);
    const contentAfter = eventData.content.length;
    if (contentBefore !== contentAfter) {
      console.log(`[generate-blog-post-v2] Links fake removidos: ${contentBefore - contentAfter} caracteres`);
    }

    // PÓS-PROCESSAMENTO: garantir que o link de VIP/camarote apareça só uma vez
    if (formFields.vipLink) {
      eventData.content = restrictLinkToFirstMention(eventData.content, formFields.vipLink);
    }

    console.log('[generate-blog-post-v2] Título após pós-processamento:', eventData.title);

    // Usar categoria do JSON ou default para "Eventos"
    const finalCategory = eventData.category || formFields.category || "Eventos";

    // IMAGEM: agora é gerada em BACKGROUND (após resposta) — não bloqueia mais.
    // Aqui só preparamos os parâmetros e respeitamos imagem já existente vinda do form.
    let generatedImageUrl: string | null = formFields.eventImageUrl || formFields.imageUrl || null;
    const imageTokensUsed = 0;
    const shouldQueueImage = generateImage && !generatedImageUrl && !!LOVABLE_API_KEY;

    const imageBgOpts = shouldQueueImage ? {
      imageTitle: eventData.title || formFields.title,
      imageSummary: eventData.excerpt || formFields.summary || '',
      imageCategory: eventData.category || formFields.category || 'Música Eletrônica',
      imageKeywords: extractKeywords(eventData.content || ''),
      imageMood: inferMood(eventData.content || '', eventData.title || formFields.title),
      imageVisualElements: `${eventData.title || formFields.title}, ${eventData.category || formFields.category || ''}, ${eventData.excerpt || formFields.summary || ''}`.substring(0, 200),
      customImagePrompt,
      lovableApiKey: LOVABLE_API_KEY!,
    } : null;
    console.log(`📸 Imagem em background: ${shouldQueueImage}`);

    // Gerar slug único
    const baseSlug = eventData.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Verificar se slug já existe e adicionar sufixo único se necessário
    let slug = baseSlug;
    let slugExists = true;
    let attempts = 0;
    
    while (slugExists && attempts < 5) {
      const { data: existingPost } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      
      if (existingPost) {
        slug = `${baseSlug}-${Date.now().toString(36)}`;
        attempts++;
      } else {
        slugExists = false;
      }
    }
    
    console.log('[generate-blog-post-v2] Slug gerado:', slug);

    // Salvar ou atualizar no banco
    let post;
    let insertError;
    
    if (formFields.existingPostId) {
      // Atualizar post existente
      console.log('[generate-blog-post-v2] Atualizando post existente:', formFields.existingPostId);
      const { data, error } = await supabase
        .from('blog_posts')
        .update({
          title: eventData.title,
          excerpt: eventData.excerpt,
          content: eventData.content,
          category: finalCategory,
          // Manter imagem existente se não gerou nova
          ...(generatedImageUrl && { image_url: generatedImageUrl }),
        })
        .eq('id', formFields.existingPostId)
        .select()
        .single();
      
      post = data;
      insertError = error;
    } else {
      // Criar novo post
      const { data, error } = await supabase
        .from('blog_posts')
        .insert({
          title: eventData.title,
          slug: slug,
          excerpt: eventData.excerpt,
          content: eventData.content,
          category: finalCategory,
          published: publishImmediately === false ? false : true,
          published_at: publishImmediately === false ? null : new Date().toISOString(),
          image_url: generatedImageUrl
        })
        .select()
        .single();
      
      post = data;
      insertError = error;
    }

    if (insertError) {
      console.error('Erro ao salvar post:', insertError);
      throw insertError;
    }

    // Registrar na tabela de posts gerados por IA
    const promptFieldsSummary = Object.entries(formFields)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${String(value).substring(0, 50)}`)
      .join(' | ');

    const { error: aiLogError } = await supabase
      .from('ai_generated_posts')
      .insert({
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
        source_urls: guardrailSourceUrls,
      });

    if (aiLogError) {
      console.error('Erro ao registrar log de IA:', aiLogError);
    }

    const totalTime = Date.now() - startTime;
    console.log(`Post V2 gerado com sucesso: ${post.id} (${totalTime}ms) imageQueued=${!!imageBgOpts}`);

    // Disparar geração de imagem em BACKGROUND (não bloqueia a resposta)
    if (imageBgOpts && post?.id) {
      try {
        // @ts-ignore — EdgeRuntime existe no runtime do Supabase
        EdgeRuntime.waitUntil(generateAndAttachImage(supabase, { postId: post.id, ...imageBgOpts }));
      } catch (bgErr) {
        console.error('Falha ao agendar geração de imagem em background:', bgErr);
      }
    }

    return jsonSuccess({
      success: true,
      post: post,
      message: imageBgOpts
        ? 'Artigo gerado! Imagem sendo processada em segundo plano.'
        : 'Artigo gerado com sucesso!',
      imageQueued: !!imageBgOpts,
      processingTimeMs: totalTime
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Erro em generate-blog-post-v2 (${totalTime}ms):`, error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonError('Operação cancelada por timeout. Tente novamente.', 504);
    }
    
    return jsonError(error instanceof Error ? error.message : 'Erro desconhecido', 500);
  }
});
