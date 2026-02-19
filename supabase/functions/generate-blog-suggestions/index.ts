import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============= CONSTANTS =============
const SCRAPE_TIMEOUT_MS = 10000; // 10 segundos por fonte (reduzido)
const AI_TIMEOUT_MS = 90000; // 90 segundos para IA responder (AUMENTADO)
const MAX_CONTENT_LENGTH = 1500; // Limite de caracteres por fonte (reduzido)
const MAX_SOURCES = 2; // Máximo 2 fontes para scraping

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

function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return jsonError(message, 500);
}

// Fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface ScrapedSource {
  name: string;
  url: string;
  content: string;
  success: boolean;
}

// Função para scrape com timeout
async function scrapeWithFirecrawl(
  url: string, 
  apiKey: string
): Promise<{ success: boolean; markdown?: string; error?: string }> {
  const startTime = Date.now();
  try {
    console.log(`[Scrape] Iniciando: ${url}`);
    
    const response = await fetchWithTimeout(
      'https://api.firecrawl.dev/v1/scrape',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 1500, // Reduzido de 2000
        }),
      },
      SCRAPE_TIMEOUT_MS
    );

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Scrape] Erro HTTP ${response.status} em ${elapsed}ms: ${errorText.substring(0, 100)}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.success && data.data?.markdown) {
      console.log(`[Scrape] Sucesso em ${elapsed}ms: ${url} (${data.data.markdown.length} chars)`);
      return { success: true, markdown: data.data.markdown };
    }
    
    console.log(`[Scrape] Sem conteúdo em ${elapsed}ms: ${url}`);
    return { success: false, error: 'No markdown content returned' };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[Scrape] Timeout após ${elapsed}ms: ${url}`);
      return { success: false, error: 'Timeout' };
    }
    console.error(`[Scrape] Erro em ${elapsed}ms: ${url}`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();
  console.log('=== GENERATE-BLOG-SUGGESTIONS INICIADO ===');

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      console.error('Nenhuma API key configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)');
      return jsonError('Nenhuma API key de IA configurada', 500);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Variáveis Supabase não configuradas');
      return jsonError('Configuração Supabase incompleta', 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar configurações de IA do site_settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['ai_temperature', 'ai_history_limit', 'ai_blog_model']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });

    const selectedModel = settingsMap['ai_blog_model'] || 'google/gemini-2.5-flash';
    const temperature = parseFloat(settingsMap['ai_temperature'] || '0.9');

    // Roteamento dual: OpenAI direto vs Gemini via Lovable
    const isOpenAIModel = selectedModel.startsWith('openai/');
    let apiKey: string;
    let apiEndpoint: string;
    let modelName: string;

    if (isOpenAIModel) {
      if (!OPENAI_API_KEY) {
        return jsonError('OPENAI_API_KEY não configurada para modelo OpenAI', 500);
      }
      apiKey = OPENAI_API_KEY;
      apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      modelName = selectedModel.replace('openai/', '');
    } else {
      if (!LOVABLE_API_KEY) {
        return jsonError('LOVABLE_API_KEY não configurada para modelo Gemini', 500);
      }
      apiKey = LOVABLE_API_KEY;
      apiEndpoint = 'https://ai.gateway.lovable.dev/v1/chat/completions';
      modelName = selectedModel;
    }
    const historyLimit = parseInt(settingsMap['ai_history_limit'] || '15');

    console.log('Configurações:', { selectedModel, modelName, isOpenAIModel, temperature, historyLimit, maxSources: MAX_SOURCES });
    console.log(`Tempo decorrido após config: ${Date.now() - startTime}ms`);

    // Buscar fontes de notícias ativas
    const { data: sources, error: sourcesError } = await supabase
      .from('news_sources')
      .select('name, url, description')
      .eq('enabled', true);

    if (sourcesError) {
      console.error('Erro ao buscar fontes:', sourcesError);
      throw sourcesError;
    }

    console.log(`Fontes encontradas: ${sources?.length || 0}`);

    // Buscar últimos N artigos publicados para evitar repetição
    const { data: recentPosts } = await supabase
      .from('blog_posts')
      .select('title, category')
      .order('created_at', { ascending: false })
      .limit(historyLimit);

    const recentTitlesAndTopics = recentPosts?.map(p => `- "${p.title}" (${p.category})`).join('\n') || 'Nenhum artigo recente';
    console.log(`Artigos recentes: ${recentPosts?.length || 0}`);
    console.log(`Tempo decorrido após queries: ${Date.now() - startTime}ms`);

    // Scraping das fontes com timeout individual
    let scrapedSources: ScrapedSource[] = [];
    const scrapeStartTime = Date.now();
    
    if (FIRECRAWL_API_KEY && sources && sources.length > 0) {
      // Limitar a MAX_SOURCES fontes
      const shuffledSources = [...sources].sort(() => Math.random() - 0.5);
      const sourcesToScrape = shuffledSources.slice(0, MAX_SOURCES);
      console.log(`Iniciando scraping de ${sourcesToScrape.length} fontes: ${sourcesToScrape.map(s => s.name).join(', ')}`);
      
      // Scrape em paralelo com timeout individual
      const scrapePromises = sourcesToScrape.map(async (source) => {
        const result = await scrapeWithFirecrawl(source.url, FIRECRAWL_API_KEY);
        
        if (result.success && result.markdown) {
          return {
            name: source.name,
            url: source.url,
            content: result.markdown.substring(0, MAX_CONTENT_LENGTH),
            success: true
          };
        }
        
        // Fallback para descrição
        return {
          name: source.name,
          url: source.url,
          content: source.description || 'Fonte de notícias sobre música eletrônica',
          success: false
        };
      });

      scrapedSources = await Promise.all(scrapePromises);
    } else {
      console.log('Sem Firecrawl ou fontes, usando descrições');
      scrapedSources = sources?.slice(0, MAX_SOURCES).map(s => ({
        name: s.name,
        url: s.url,
        content: s.description || 'Fonte de notícias',
        success: false
      })) || [];
    }

    const scrapeElapsed = Date.now() - scrapeStartTime;
    const scrapedCount = scrapedSources.filter(s => s.success).length;
    console.log(`Scraping concluído em ${scrapeElapsed}ms: ${scrapedCount}/${scrapedSources.length} fontes com conteúdo real`);
    console.log(`Tempo total até agora: ${Date.now() - startTime}ms`);

    // Construir texto das fontes
    const sourcesWithContent = scrapedSources.map(s => {
      if (s.success) {
        return `### ${s.name} (${s.url})\nConteúdo recente:\n${s.content}\n`;
      }
      return `### ${s.name} (${s.url})\nDescrição: ${s.content}\n`;
    }).join('\n---\n');

    // Prompt para gerar 5 sugestões
    const systemPrompt = `Você é um jornalista especializado em música eletrônica e cultura de clubes brasileira e internacional.
Sua tarefa é analisar as notícias e tendências reais das fontes fornecidas e gerar 5 sugestões de artigos COMPLETAMENTE NOVOS e DIFERENTES.

⚠️ REGRA CRÍTICA - EVITE REPETIÇÃO:
Os seguintes artigos JÁ FORAM PUBLICADOS recentemente no nosso site. VOCÊ NÃO PODE sugerir temas similares:

${recentTitlesAndTopics}

🚫 NÃO SUGIRA temas que já aparecem na lista acima.

✅ VOCÊ DEVE buscar assuntos COMPLETAMENTE NOVOS nas fontes.

${scrapedCount > 0 ? 
  `FONTES DE REFERÊNCIA (${scrapedCount} fontes scrapeadas):\n${sourcesWithContent}` : 
  `FONTES DE REFERÊNCIA:\n${sourcesWithContent}`
}`;

    const userPrompt = `Analise as fontes e gere 5 sugestões INÉDITAS de artigos sobre a cena eletrônica.

Cada sugestão deve incluir:
- título: Título ÚNICO e atraente (máximo 80 caracteres)
- summary: Resumo breve do tema (2-3 frases)
- category: Categoria (Eventos, Produtores, Tecnologia, Cultura, Lançamentos, Festivais)
- keywords: Palavras-chave separadas por vírgula
- mood: Atmosfera visual (energético, introspectivo, celebratório, underground, futurista)
- visualElements: Elementos visuais sugeridos para imagem

DIVERSIFIQUE as categorias.`;

    console.log(`Chamando IA (${modelName} via ${isOpenAIModel ? 'OpenAI direto' : 'Lovable Gateway'})...`);
    const aiStartTime = Date.now();

    // Preparar body da requisição
    const requestBody: Record<string, unknown> = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      ...(isOpenAIModel ? {} : { temperature }),
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_suggestions',
            description: 'Gera 5 sugestões ÚNICAS de artigos sobre música eletrônica',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Título ÚNICO do artigo (máx 80 chars)' },
                      summary: { type: 'string', description: 'Resumo breve do tema (2-3 frases)' },
                      category: { type: 'string', description: 'Categoria do artigo' },
                      keywords: { type: 'string', description: 'Palavras-chave separadas por vírgula' },
                      mood: { type: 'string', description: 'Atmosfera visual sugerida' },
                      visualElements: { type: 'string', description: 'Elementos visuais sugeridos' }
                    },
                    required: ['title', 'summary', 'category', 'keywords', 'mood', 'visualElements']
                  },
                  minItems: 5,
                  maxItems: 5
                }
              },
              required: ['suggestions']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'generate_suggestions' } }
    };

    // Chamar IA com timeout de 90s
    let aiResponse: Response;
    try {
      aiResponse = await fetchWithTimeout(
        apiEndpoint,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        AI_TIMEOUT_MS
      );
    } catch (fetchError) {
      const aiElapsed = Date.now() - aiStartTime;
      const totalElapsed = Date.now() - startTime;
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Erro desconhecido';
      const isTimeout = errorMsg.includes('abort') || errorMsg.includes('Abort');
      
      console.error(`[IA] FALHA após ${aiElapsed}ms (total: ${totalElapsed}ms): ${isTimeout ? 'TIMEOUT' : errorMsg}`);
      
      if (isTimeout) {
        return jsonError(`Timeout na IA após ${aiElapsed}ms. Scraping levou ${scrapeElapsed}ms.`, 504);
      }
      throw fetchError;
    }

    const aiElapsed = Date.now() - aiStartTime;
    console.log(`Resposta IA recebida em ${aiElapsed}ms`);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na IA:', aiResponse.status, errorText.substring(0, 200));
      
      if (aiResponse.status === 429) {
        return jsonError('Limite de requisições excedido. Tente novamente em alguns instantes.', 429);
      }
      
      if (aiResponse.status === 402) {
        return jsonError('Créditos insuficientes. Por favor, adicione créditos ao workspace.', 402);
      }

      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('Resposta IA sem tool_call:', JSON.stringify(aiData).substring(0, 500));
      throw new Error('Resposta da IA não contém tool call esperado');
    }

    let suggestions;
    try {
      suggestions = JSON.parse(toolCall.function.arguments).suggestions;
    } catch (parseError) {
      console.error('Erro ao parsear argumentos:', toolCall.function.arguments.substring(0, 500));
      throw new Error('Falha ao parsear resposta da IA');
    }

    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      console.error('Sugestões inválidas:', suggestions);
      throw new Error('IA retornou sugestões inválidas');
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`=== SUCESSO em ${totalElapsed}ms ===`);
    console.log(`Breakdown: Config=${Date.now() - startTime - scrapeElapsed - aiElapsed}ms, Scrape=${scrapeElapsed}ms, IA=${aiElapsed}ms`);
    console.log(`Sugestões geradas: ${suggestions.length}`);

    return jsonSuccess({ 
      suggestions,
      scrapedSources: scrapedCount,
      totalSources: scrapedSources.length,
      elapsedMs: totalElapsed,
      breakdown: {
        scrapeMs: scrapeElapsed,
        aiMs: aiElapsed
      }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`=== ERRO em ${elapsed}ms ===`, error);
    return handleError(error, 'generate-blog-suggestions');
  }
});
