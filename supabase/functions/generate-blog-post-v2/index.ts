import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

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

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { templateId, generateImage, ...formFields } = body;

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
    if (!formFields.eventLocation && (formFields.venue || formFields.locationCity)) {
      formFields.eventLocation = [
        formFields.venue,
        formFields.locationCity,
        formFields.locationState
      ].filter(Boolean).join(' - ');
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
    let scrapedContext = '';
    if (FIRECRAWL_API_KEY && remainingMs > 15000 && !generateImage) {
      try {
        const { data: sources } = await supabase
          .from('news_sources')
          .select('name, url')
          .eq('enabled', true)
          .limit(maxScrapeSources);
        
        if (sources && sources.length > 0) {
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

    // Log do prompt após substituições
    console.log('[generate-blog-post-v2] User prompt após substituições (preview):', userPrompt.substring(0, 800));

    // Determinar se há link de ingresso real
    const hasRealTicketLink = formFields.ticketLink && 
      typeof formFields.ticketLink === 'string' && 
      formFields.ticketLink.length > 5 &&
      !FAKE_DOMAINS.some(domain => formFields.ticketLink.includes(domain));

    // Adicionar instrução de tamanho máximo ao system prompt
    const systemPromptWithLength = template.system_prompt + 
      `\n\nIMPORTANTE: 
- O artigo deve ter no máximo ${maxArticleLength} caracteres.
- NUNCA use placeholders como {{eventName}}, {{eventDate}}, {{lineup}}, etc. no texto gerado.
- Use os valores REAIS que foram fornecidos no prompt.
- Se algum valor não foi fornecido, omita essa informação ou escreva "a confirmar".

🚨 REGRA CRÍTICA — DADOS DO PROMPT TÊM PRIORIDADE ABSOLUTA:
- Use EXCLUSIVAMENTE os dados fornecidos no prompt (local, venue, endereço, datas, horários).
- NÃO use conhecimento prévio ou de treinamento sobre locais, datas ou venues de eventos.
- Se o local informado no prompt difere do que você conhece sobre o evento, USE O INFORMADO NO PROMPT.
- Em caso de conflito entre "description" e os campos estruturados (venue, eventLocation, eventDate), PRIORIZE os campos estruturados.
- Gere um título NOVO baseado nos dados atuais, não reutilize títulos anteriores.

🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS:
${hasRealTicketLink 
  ? `- Link de ingressos REAL fornecido: ${formFields.ticketLink}
- Você PODE incluir seção de ingressos com cupom MDACCULA usando este link.`
  : `- NÃO há link de ingressos fornecido para este artigo.
- NUNCA INVENTE URLs de ingressos como "ticketlink.com.br", "ingressos.com.br", etc.
- NÃO inclua seção de "Ingressos", "Onde comprar" ou "Garanta seu lugar".
- NÃO mencione cupom de desconto MDACCULA se não houver link real.
- Se for artigo noticioso, foque no conteúdo informativo.
- Use CTA alternativo: "Acompanhe a MDAccula para mais novidades da cena eletrônica."`
}`;
    
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
    }
    
    // Calculate remaining time for AI text generation
    const elapsedBeforeAI = Date.now() - startTime;
    const aiTextTimeout = Math.min(50000, FUNCTION_TIMEOUT_MS - elapsedBeforeAI - (generateImage ? 35000 : 5000));
    console.log(`⏱️ AI text timeout: ${aiTextTimeout}ms (elapsed: ${elapsedBeforeAI}ms, reserving ${generateImage ? '35s' : '5s'} for remaining steps)`);
    
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

    console.log('[generate-blog-post-v2] Título após pós-processamento:', eventData.title);

    // Usar categoria do JSON ou default para "Eventos"
    const finalCategory = eventData.category || formFields.category || "Eventos";

    // GERAR IMAGEM APÓS PARSE DO JSON
    let generatedImageUrl = formFields.eventImageUrl || formFields.imageUrl || null;
    let imageTokensUsed = 0;
    
    // Check if we have time for image generation (threshold reduzido para 25s)
    const elapsedTotal = Date.now() - startTime;
    const timeForImage = FUNCTION_TIMEOUT_MS - elapsedTotal;
    const IMAGE_TIME_THRESHOLD = 25000; // 25 segundos necessários para gerar imagem
    
    console.log(`=== DIAGNÓSTICO DE TEMPO ===`);
    console.log(`⏱️ Tempo total decorrido: ${elapsedTotal}ms`);
    console.log(`⏱️ Tempo disponível para imagem: ${timeForImage}ms`);
    console.log(`⏱️ Threshold mínimo: ${IMAGE_TIME_THRESHOLD}ms`);
    console.log(`📸 Vai gerar imagem: ${timeForImage > IMAGE_TIME_THRESHOLD && generateImage && !generatedImageUrl && !!LOVABLE_API_KEY}`);
    console.log(`📸 Condições detalhadas: generateImage=${generateImage}, hasUrl=${!!generatedImageUrl}, timeOk=${timeForImage > IMAGE_TIME_THRESHOLD}, hasKey=${!!LOVABLE_API_KEY}`);
    
    if (generateImage && !generatedImageUrl && timeForImage > IMAGE_TIME_THRESHOLD && LOVABLE_API_KEY) {
      const imageTitle = eventData.title || formFields.title;
      const imageSummary = eventData.excerpt || formFields.summary || '';
      const imageCategory = eventData.category || formFields.category || 'Música Eletrônica';
      const imageKeywords = extractKeywords(eventData.content || '');
      const imageMood = inferMood(eventData.content || '', imageTitle);
      const imageVisualElements = `${imageTitle}, ${imageCategory}, ${imageSummary}`.substring(0, 200);
      
      const MAX_IMAGE_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
        // Verificar se ainda há tempo
        const attemptTimeRemaining = FUNCTION_TIMEOUT_MS - (Date.now() - startTime);
        if (attemptTimeRemaining < 20000) {
          console.log(`⏱️ Tempo insuficiente para tentativa ${attempt} de imagem (${attemptTimeRemaining}ms restantes)`);
          break;
        }

        try {
          console.log(`[${Date.now()}] 🎨 Tentativa ${attempt}/${MAX_IMAGE_ATTEMPTS} de geração de imagem para: ${imageTitle}`);
          
          // Usar template customizado do banco OU sistema de estilos variados
          let selectedPromptTemplate: string;
          if (customImagePrompt) {
            selectedPromptTemplate = customImagePrompt;
            console.log('🎨 Usando template customizado de prompt de imagem');
          } else {
            const style = await pickRandomStyle(supabase);
            selectedPromptTemplate = style.prompt;
            console.log(`🎨 Usando estilo variado #${style.index}`);
          }
          
          let imagePrompt = selectedPromptTemplate
            .replace(/\{\{title\}\}/g, imageTitle)
            .replace(/\{\{summary\}\}/g, imageSummary)
            .replace(/\{\{category\}\}/g, imageCategory)
            .replace(/\{\{keywords\}\}/g, imageKeywords)
            .replace(/\{\{mood\}\}/g, imageMood)
            .replace(/\{\{visualElements\}\}/g, imageVisualElements);
          
          console.log('Prompt de imagem:', imagePrompt.substring(0, 300) + '...');
          
          const imageTimeout = Math.min(30000, attemptTimeRemaining - 8000);
          const imageResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image',
              messages: [{ role: 'user', content: imagePrompt }],
              modalities: ['image', 'text']
            })
          }, imageTimeout);

          if (!imageResponse.ok) {
            console.error(`[${Date.now()}] ❌ Tentativa ${attempt}: API retornou status ${imageResponse.status}`);
            continue;
          }

          const imageData = await imageResponse.json();
          const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (imageData.usage) {
            imageTokensUsed = imageData.usage.total_tokens || 0;
          }
          
          if (!base64Image) {
            console.error(`[${Date.now()}] ❌ Tentativa ${attempt}: Sem base64 na resposta`);
            continue;
          }

          // Validar tamanho mínimo do base64 (imagens reais > 1KB)
          const base64Data = base64Image.split(',')[1];
          if (!base64Data || base64Data.length < 1024) {
            console.error(`[${Date.now()}] ❌ Tentativa ${attempt}: Base64 muito pequeno (${base64Data?.length || 0} chars) — imagem provavelmente inválida`);
            continue;
          }

          const pngBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          if (pngBuffer.length < 1024) {
            console.error(`[${Date.now()}] ❌ Tentativa ${attempt}: Buffer de imagem muito pequeno (${pngBuffer.length} bytes)`);
            continue;
          }

          console.log(`[${Date.now()}] ✅ Tentativa ${attempt}: Imagem válida (${pngBuffer.length} bytes), convertendo para WebP...`);
          
          let finalBuffer: Uint8Array;
          let fileExt = 'png';
          let contentType = 'image/png';
          try {
            const image = await Image.decode(pngBuffer);
            const maxDimension = 1024;
            if (image.width > maxDimension || image.height > maxDimension) {
              const scale = maxDimension / Math.max(image.width, image.height);
              const newWidth = Math.round(image.width * scale);
              const newHeight = Math.round(image.height * scale);
              image.resize(newWidth, newHeight);
              console.log(`Imagem redimensionada para ${newWidth}x${newHeight}`);
            }
            finalBuffer = await image.encodeWEBP(85);
            fileExt = 'webp';
            contentType = 'image/webp';
            console.log(`Conversão WebP: ${pngBuffer.length} -> ${finalBuffer.length} bytes`);
          } catch (conversionError) {
            console.error('Erro na conversão WebP, usando PNG original:', conversionError);
            finalBuffer = pngBuffer;
          }
          
          const fileName = `ai-generated-${Date.now()}.${fileExt}`;
          
          const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY')?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
          if (BUNNY_STORAGE_API_KEY) {
            const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
            const bunnyUploadUrl = `https://${bunnyHostname}/mdaccula/event-images/${fileName}`;
            const uploadResp = await fetch(bunnyUploadUrl, {
              method: 'PUT',
              headers: {
                AccessKey: BUNNY_STORAGE_API_KEY,
                'Content-Type': contentType,
              },
              body: finalBuffer,
            });

            if (uploadResp.ok) {
              generatedImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
              console.log(`[${Date.now()}] ✅ Upload Bunny concluído: ${generatedImageUrl}`);
              break; // Sucesso! Sair do loop
            } else {
              console.error(`[${Date.now()}] ❌ Tentativa ${attempt}: Erro no upload Bunny:`, await uploadResp.text());
            }
          } else {
            console.error(`[${Date.now()}] ❌ BUNNY_STORAGE_API_KEY não configurada`);
            break; // Sem chave, não adianta retry
          }
        } catch (imageError) {
          if (imageError instanceof Error && imageError.name === 'AbortError') {
            console.log(`⏱️ Tentativa ${attempt}: Timeout na geração de imagem`);
          } else {
            console.error(`[${Date.now()}] ❌ Tentativa ${attempt}: Erro:`, imageError);
          }
        }
      }

      if (!generatedImageUrl) {
        console.warn(`⚠️ Todas as ${MAX_IMAGE_ATTEMPTS} tentativas de geração de imagem falharam. Post será salvo sem imagem.`);
      }
    }

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
          published: true,
          published_at: new Date().toISOString(),
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
      });

    if (aiLogError) {
      console.error('Erro ao registrar log de IA:', aiLogError);
    }

    const totalTime = Date.now() - startTime;
    console.log(`Post V2 gerado com sucesso: ${post.id} (${totalTime}ms)`);

    return jsonSuccess({ 
      success: true, 
      post: post,
      message: 'Artigo sobre evento gerado com sucesso!',
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
