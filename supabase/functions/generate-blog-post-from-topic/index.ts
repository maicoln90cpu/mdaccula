import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeTitle, validateTitle } from "../_shared/titleSanitizer.ts";
import { EDITORIAL_QUALITY_BLOCK } from "../_shared/editorialQuality.ts";

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

const SEARCH_TIMEOUT_MS = 30000;
const AI_TIMEOUT_MS = 100000;
const MAX_SOURCES = 5;
const MAX_CONTENT_LENGTH = 2000;

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

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

// Busca + scraping em uma chamada só via Firecrawl /v1/search.
// Formato de resposta documentado: { success, data: { web: [{ title, url, markdown, metadata }] } }.
// Faz parsing defensivo (também aceita data como array puro) porque a Firecrawl já
// mudou esse formato entre versões da API.
async function searchWithFirecrawl(query: string, apiKey: string, limit: number): Promise<SearchResult[]> {
  const response = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }),
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl search HTTP ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawResults: unknown[] = Array.isArray(data?.data?.web)
    ? data.data.web
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const results: SearchResult[] = [];
  for (const item of rawResults) {
    const r = item as Record<string, unknown>;
    const markdown = typeof r.markdown === 'string' ? r.markdown : '';
    const metadata = (r.metadata as Record<string, unknown>) || {};
    const url = (typeof r.url === 'string' && r.url) || (typeof metadata.sourceURL === 'string' && metadata.sourceURL) || '';
    const title = (typeof r.title === 'string' && r.title) || (typeof metadata.title === 'string' && metadata.title) || url;
    if (markdown && url) {
      results.push({ title: String(title), url: String(url), content: markdown.substring(0, MAX_CONTENT_LENGTH) });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const generateImage = Boolean(body?.generateImage);
    // Omitido (undefined) preserva o comportamento histórico de sempre publicar,
    // pro chamador original desta function (busca por tema manual no admin).
    // Só `false` explícito nasce como rascunho — mesma convenção de generate-blog-post-v2.
    const publishImmediately = body?.publishImmediately;

    if (!query) {
      return jsonError('Informe um termo de busca (ex: "Solomun São Paulo")', 400);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError('Configuração de ambiente incompleta', 500);
    }
    if (!FIRECRAWL_API_KEY) {
      return jsonError('FIRECRAWL_API_KEY não configurada — necessária para gerar artigo por busca de tema.', 500);
    }
    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      return jsonError('Nenhuma API key de IA configurada', 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Buscar + raspar fontes reais sobre o termo
    console.log(`[generate-blog-post-from-topic] Buscando fontes para: "${query}"`);
    let searchResults: SearchResult[] = [];
    try {
      searchResults = await searchWithFirecrawl(query, FIRECRAWL_API_KEY, MAX_SOURCES);
    } catch (searchError) {
      console.error('[generate-blog-post-from-topic] Erro na busca Firecrawl:', searchError);
      return jsonError('Falha ao buscar fontes para esse termo. Tente novamente em instantes.', 502);
    }

    if (searchResults.length === 0) {
      return jsonError(`Nenhuma fonte encontrada para "${query}". Tente um termo mais específico ou mais popular.`, 404);
    }

    console.log(`[generate-blog-post-from-topic] ${searchResults.length} fontes raspadas com sucesso`);
    const sourceUrls = searchResults.map((r) => r.url);

    const sourcesBlock = searchResults
      .map((r, i) => `### Fonte ${i + 1}: ${r.title} (${r.url})\n${r.content}`)
      .join('\n\n---\n\n');

    // 2) Configurações de IA
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['ai_blog_model', 'ai_temperature']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s) => { settingsMap[s.key] = s.value || ''; });

    const selectedModel = settingsMap['ai_blog_model'] || 'google/gemini-2.5-flash';
    const temperature = parseFloat(settingsMap['ai_temperature'] || '0.9');

    // 3) Prompt dedicado — jornalismo baseado em fontes reais, com o mesmo
    // mandato anti-invenção usado no bloco "DADOS OFICIAIS" das outras functions,
    // aplicado aqui às fontes encontradas via busca.
    const systemPrompt = `Você é um jornalista especializado em música eletrônica, escrevendo para um blog moderno inspirado em veículos como Mixmag, DJ Mag, Billboard e Electronic Groove.

Você recebeu um conjunto de fontes reais (resultado de uma busca na web) sobre o termo "${query}". Sua tarefa é escrever um artigo jornalístico ancorado EXCLUSIVAMENTE nos fatos presentes nessas fontes.

🚨 REGRA CRÍTICA — FONTES TÊM PRIORIDADE ABSOLUTA:
- Use APENAS fatos, citações e dados que aparecem no bloco FONTES ENCONTRADAS abaixo.
- NUNCA invente datas, nomes, números ou eventos que não estejam nas fontes.
- Se as fontes forem insuficientes ou conflitantes sobre algum ponto, omita esse ponto — não especule.
- Cite o contexto das fontes de forma natural no texto (sem citar "Fonte 1" literalmente — integre a informação como prosa jornalística).

ESTRUTURA OBRIGATÓRIA (retorne APENAS JSON válido):
{
  "title": "Título editorial chamativo (50-80 caracteres, sem emoji, sem data literal)",
  "excerpt": "Resumo de 1-2 frases (máx 200 caracteres)",
  "content": "HTML do artigo completo, 900 a 1300 palavras",
  "category": "uma de: Produtores, Tecnologia, Cultura, Lançamentos, Festivais, Cena"
}

FORMATAÇÃO HTML: <h2>/<h3> para seções, <p> para parágrafos, <strong> para destaques.
RETORNE APENAS O JSON, sem markdown, sem texto adicional.
${EDITORIAL_QUALITY_BLOCK}`;

    const userPrompt = `Escreva um artigo jornalístico completo sobre "${query}", baseado nas fontes abaixo.

FONTES ENCONTRADAS (use literalmente, NUNCA invente além do que está aqui):

${sourcesBlock}

TAMANHO: 900 a 1300 palavras. Retorne APENAS o JSON válido conforme system prompt.`;

    // 4) Roteamento dual OpenAI/Gemini + params gpt-5*
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

    const isGpt5 = isOpenAIModel && modelName.startsWith('gpt-5');

    console.log(`[generate-blog-post-from-topic] Enviando para IA (${modelName} via ${isOpenAIModel ? 'OpenAI direto' : 'Lovable Gateway'})...`);

    const aiResponse = await fetchWithTimeout(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(isOpenAIModel ? {} : { temperature }),
        ...(isGpt5 ? { reasoning_effort: 'minimal', verbosity: 'high' } : {}),
      }),
    }, AI_TIMEOUT_MS);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API de IA:', aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return jsonError('Limite de requisições excedido. Tente em alguns minutos.', 429);
      }
      if (aiResponse.status === 402) {
        return jsonError('Créditos insuficientes. Adicione em Settings → Workspace → Usage.', 402);
      }
      throw new Error(`Erro na API: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let generatedContent = aiData.choices?.[0]?.message?.content;
    const usage = aiData.usage || {};

    if (!generatedContent) {
      throw new Error('IA não retornou conteúdo');
    }

    generatedContent = generatedContent.trim();
    if (generatedContent.startsWith('```json')) {
      generatedContent = generatedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (generatedContent.startsWith('```')) {
      generatedContent = generatedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let articleData;
    try {
      articleData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      throw new Error('IA não retornou JSON válido');
    }

    if (!articleData.title || !articleData.content) {
      throw new Error('IA não gerou dados completos');
    }

    const titleCheck = validateTitle(articleData.title);
    if (!titleCheck.valid) {
      console.warn('[generate-blog-post-from-topic] Título com issues:', titleCheck.issues, '| original:', articleData.title);
    }
    articleData.title = sanitizeTitle(titleCheck.cleaned);

    const allowedCategories = ['Produtores', 'Tecnologia', 'Cultura', 'Lançamentos', 'Festivais', 'Cena'];
    const finalCategory = allowedCategories.includes(articleData.category) ? articleData.category : 'Cultura';

    // 5) Slug único
    const baseSlug = articleData.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

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

    const { data: post, error: insertError } = await supabase
      .from('blog_posts')
      .insert({
        title: articleData.title,
        slug,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category: finalCategory,
        published: publishImmediately === false ? false : true,
        published_at: publishImmediately === false ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao salvar post:', insertError);
      throw insertError;
    }

    console.log(`[generate-blog-post-from-topic] Post criado: ${post.id}`);

    const { error: aiLogError } = await supabase
      .from('ai_generated_posts')
      .insert({
        blog_post_id: post.id,
        prompt_used: `Busca por tema: "${query}" (${searchResults.length} fontes)`,
        model_used: selectedModel,
        input_tokens: usage.prompt_tokens || null,
        output_tokens: usage.completion_tokens || null,
        total_tokens: usage.total_tokens || null,
        source_urls: sourceUrls,
      });

    if (aiLogError) {
      console.error('Erro ao registrar log de IA:', aiLogError);
    }

    // 6) Imagem de capa (opcional, mesmo padrão de estilo variado das outras functions)
    if (generateImage && LOVABLE_API_KEY) {
      try {
        const timeForImage = AI_TIMEOUT_MS - (Date.now() - startTime);
        if (timeForImage > 30000) {
          const imagePrompt = `Crie uma imagem editorial para um artigo sobre música eletrônica com o tema: "${articleData.title}". Estilo fotorrealista ou ilustração artística, sem texto, sem palavras, sem números na imagem.`;
          const imageResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image',
              messages: [{ role: 'user', content: imagePrompt }],
              modalities: ['image', 'text'],
            }),
          }, 40000);

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (base64Image) {
              const base64Data = base64Image.split(',')[1];
              const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
              let fileExt = 'png';
              let contentType = 'image/png';
              if (imageBytes.length > 12 && imageBytes[0] === 0x52 && imageBytes[1] === 0x49) {
                fileExt = 'webp';
                contentType = 'image/webp';
              }
              const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY')?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
              if (BUNNY_STORAGE_API_KEY) {
                const bunnyHostname = Deno.env.get('BUNNY_STORAGE_HOSTNAME') || 'storage.bunnycdn.com';
                const fileName = `topic-${Date.now()}.${fileExt}`;
                const uploadResp = await fetch(`https://${bunnyHostname}/mdaccula/event-images/${fileName}`, {
                  method: 'PUT',
                  headers: { AccessKey: BUNNY_STORAGE_API_KEY, 'Content-Type': contentType },
                  body: imageBytes,
                });
                if (uploadResp.ok) {
                  const generatedImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
                  await supabase.from('blog_posts').update({ image_url: generatedImageUrl }).eq('id', post.id);
                  post.image_url = generatedImageUrl;
                }
              }
            }
          }
        }
      } catch (imageError) {
        console.error('[generate-blog-post-from-topic] Erro na geração de imagem:', imageError);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[generate-blog-post-from-topic] Concluído em ${totalTime}ms`);

    return jsonSuccess({
      success: true,
      post,
      sourcesUsed: sourceUrls,
      message: `Artigo gerado a partir de ${searchResults.length} fontes!`,
      processingTimeMs: totalTime,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Erro em generate-blog-post-from-topic (${totalTime}ms):`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonError('Operação cancelada por timeout. Tente novamente.', 504);
    }
    return jsonError(error instanceof Error ? error.message : 'Erro desconhecido', 500);
  }
});
