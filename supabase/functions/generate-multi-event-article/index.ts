import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const FUNCTION_TIMEOUT_MS = 120000; // 120 seconds

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

// Format date in Portuguese
function formatDatePt(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  return `${date.getDate()} de ${months[date.getMonth()]} (${days[date.getDay()]})`;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { eventIds, seriesName, additionalContext, generateImage, customImageUrl, existingPostId } = body;

    // Validate required fields
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length < 2) {
      return jsonError('É necessário selecionar pelo menos 2 eventos', 400);
    }

    if (!seriesName || typeof seriesName !== 'string' || !seriesName.trim()) {
      return jsonError('Nome da série é obrigatório', 400);
    }

    const isRegeneration = !!existingPostId;

    console.log('[generate-multi-event-article] Iniciando para:', {
      seriesName,
      eventCount: eventIds.length,
      eventIds,
      isRegeneration,
      existingPostId
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError('Configuração de ambiente incompleta', 500);
    }

    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      return jsonError('Nenhuma API key de IA configurada', 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all selected events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIds)
      .order('date', { ascending: true });

    if (eventsError) {
      throw new Error(`Erro ao buscar eventos: ${eventsError.message}`);
    }

    if (!events || events.length === 0) {
      return jsonError('Nenhum evento encontrado com os IDs fornecidos', 404);
    }

    console.log(`[generate-multi-event-article] ${events.length} eventos encontrados`);

    // Extract common information
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const commonVenue = firstEvent.venue;
    const commonCity = firstEvent.location_city;
    const commonState = firstEvent.location_state;
    
    // Collect all unique genres
    const allGenres = [...new Set(events.flatMap(e => e.genres || []))];
    
    // Find first available image or use custom
    const existingImageUrl = customImageUrl || events.find(e => e.image_url)?.image_url || null;

    // Build detailed dates info
    const datesInfo = events.map(event => {
      const lineupStr = event.lineup && event.lineup.length > 0 
        ? event.lineup.join(', ') 
        : 'A confirmar';
      
      return `
📅 ${formatDatePt(event.date)} - ${event.time}
🎧 Line-up: ${lineupStr}
${event.ticket_link ? `🎟️ Ingressos: ${event.ticket_link}` : ''}
${event.vip_link ? `💎 VIP/Camarote: ${event.vip_link}` : ''}
${event.description ? `📝 ${event.description}` : ''}`.trim();
    }).join('\n\n');

    // Fetch AI settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['ai_blog_model', 'ai_temperature']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });

    const selectedModel = settingsMap['ai_blog_model'] || 'google/gemini-2.5-flash';
    const temperature = parseFloat(settingsMap['ai_temperature'] || '0.9');

    // Fetch prompt template from database
    const { data: template } = await supabase
      .from('ai_prompt_templates')
      .select('system_prompt, user_prompt_template')
      .eq('category', 'Multi-Eventos')
      .eq('enabled', true)
      .eq('is_default', true)
      .maybeSingle();

    // Default prompts (fallback if no template found)
    const defaultSystemPrompt = `Você é um jornalista renomado especializado em música eletrônica brasileira e internacional, escrevendo para um público apaixonado pela cena underground e pelos grandes eventos.

ESTILO EDITORIAL:
- Tom entusiasmado, vibrante e profissional
- Linguagem rica e descritiva que transporta o leitor para a experiência
- Conhecimento profundo da cena eletrônica e seus artistas
- Português brasileiro fluido e envolvente

ESTRUTURA OBRIGATÓRIA (JSON):
{
  "title": "Título chamativo e SEO-friendly (máx 70 caracteres)",
  "excerpt": "Resumo que gere curiosidade (máx 160 caracteres)",
  "content": "Artigo HTML completo (1500-2500 palavras)",
  "category": "Eventos"
}

FORMATAÇÃO HTML:
- <h2> para seções principais
- <h3> para cada data/evento individual
- <p> para parágrafos descritivos
- <strong> para destaques importantes
- <a href="URL" target="_blank"> para links de ingressos
- <ul><li> para listas quando apropriado

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou explicações
- Inclua TODOS os links de ingressos fornecidos de forma natural
- Use dados reais fornecidos, nunca invente informações`;

    const defaultUserPromptTemplate = `Escreva um artigo COMPLETO e EXTENSO sobre a série de eventos "{{seriesName}}":

📍 LOCAL: {{venue}}, {{city}} - {{state}}
📅 PERÍODO: {{startDate}} a {{endDate}}
🎵 GÊNEROS: {{genres}}

---

## PROGRAMAÇÃO DETALHADA:
{{dates}}

---

{{additionalContext}}

---

## INSTRUÇÕES ESPECÍFICAS:

### INTRODUÇÃO (3-4 parágrafos extensos):
1. Apresente a série "{{seriesName}}" como um acontecimento imperdível
2. Fale sobre a HISTÓRIA e REPUTAÇÃO da produtora/label organizadora
3. Descreva o LOCAL em detalhes - atmosfera, estrutura, por que é especial
4. Contextualize o período (Carnaval, verão, etc) e a relevância para a cena

### CADA DATA/EVENTO (mínimo 5-6 linhas por dia):
Para CADA data, crie uma seção <h3> incluindo:
1. Data formatada em destaque
2. Contexto sobre os artistas PRINCIPAIS - quem são, de onde vêm, estilo
3. Por que esse lineup é especial ou imperdível
4. Sets esperados, horários (se disponíveis)
5. Link de ingressos em destaque com call-to-action
6. Menção aos artistas de apoio

### ARTISTAS EM DESTAQUE:
Para artistas mais famosos/headliners, inclua:
- Origem e trajetória resumida
- Releases ou sets marcantes
- Por que a apresentação será especial
- Contexto de apresentações anteriores no Brasil (se relevante)

### CONCLUSÃO:
1. Resumo geral de por que não perder a série
2. Dica para quem quer aproveitar todas as datas
3. Informações práticas (local, como chegar)
4. Call-to-action final com link para ingressos

### TAMANHO: 1500-2500 palavras

Retorne APENAS o JSON válido.`;

    // Use template from DB or fallback
    const systemPrompt = template?.system_prompt || defaultSystemPrompt;
    const userPromptTemplate = template?.user_prompt_template || defaultUserPromptTemplate;

    // Replace template variables
    const userPrompt = userPromptTemplate
      .replace(/\{\{seriesName\}\}/g, seriesName)
      .replace(/\{\{venue\}\}/g, commonVenue)
      .replace(/\{\{city\}\}/g, commonCity)
      .replace(/\{\{state\}\}/g, commonState)
      .replace(/\{\{startDate\}\}/g, formatDatePt(firstEvent.date))
      .replace(/\{\{endDate\}\}/g, formatDatePt(lastEvent.date))
      .replace(/\{\{genres\}\}/g, allGenres.join(', ') || 'Música Eletrônica')
      .replace(/\{\{dates\}\}/g, datesInfo)
      .replace(/\{\{additionalContext\}\}/g, additionalContext ? `## CONTEXTO ADICIONAL:\n${additionalContext}` : '');

    console.log('[generate-multi-event-article] Usando template:', template ? 'do banco' : 'fallback padrão');

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

    console.log(`[generate-multi-event-article] Enviando para IA (${modelName} via ${isOpenAIModel ? 'OpenAI direto' : 'Lovable Gateway'})...`);

    // Call AI API with longer timeout for multi-event
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
          { role: 'user', content: userPrompt }
        ],
        ...(isOpenAIModel ? {} : { temperature }),
      }),
    }, 90000);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return jsonError("Limite de requisições excedido. Tente em alguns minutos.", 429);
      }
      
      if (aiResponse.status === 402) {
        return jsonError("Créditos insuficientes. Adicione em Settings → Workspace → Usage.", 402);
      }
      
      throw new Error(`Erro na API: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let generatedContent = aiData.choices?.[0]?.message?.content;
    const usage = aiData.usage || {};

    if (!generatedContent) {
      throw new Error('IA não retornou conteúdo');
    }

    console.log('[generate-multi-event-article] Conteúdo recebido, parseando...');

    // Clean markdown if present
    generatedContent = generatedContent.trim();
    if (generatedContent.startsWith('```json')) {
      generatedContent = generatedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (generatedContent.startsWith('```')) {
      generatedContent = generatedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse JSON
    let articleData;
    try {
      articleData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.error('Conteúdo recebido:', generatedContent.substring(0, 500));
      throw new Error('IA não retornou JSON válido');
    }

    if (!articleData.title || !articleData.content) {
      throw new Error('IA não gerou dados completos');
    }

    // Generate image if needed (only for new posts or if explicitly requested)
    let finalImageUrl = existingImageUrl;
    let imageTokensUsed = 0;
    
    const timeForImage = FUNCTION_TIMEOUT_MS - (Date.now() - startTime);
    
    if (generateImage && !finalImageUrl && !isRegeneration && timeForImage > 35000) {
      try {
        console.log('[generate-multi-event-article] Gerando imagem...');
        
        const imagePrompt = `Crie uma imagem artística e profissional para um artigo sobre uma série de eventos de música eletrônica chamada "${seriesName}".
Local: ${commonVenue}, ${commonCity}
Gêneros: ${allGenres.join(', ')}
Atmosfera: festa, energia, multidão animada, luzes

Estilo: fotorrealista, cinematográfico, alta qualidade
NÃO inclua texto na imagem.`;

        const imageResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: imagePrompt }],
            modalities: ['image', 'text']
          })
        }, 40000);

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (imageData.usage) {
            imageTokensUsed = imageData.usage.total_tokens || 0;
          }
          
          if (base64Image) {
            const base64Data = base64Image.split(',')[1];
            const pngBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const fileName = `multi-event-${Date.now()}.webp`;
            
            const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY');
            if (BUNNY_STORAGE_API_KEY) {
              const bunnyUploadUrl = `https://br.storage.bunnycdn.com/mdacula/event-images/${fileName}`;
              const uploadResp = await fetch(bunnyUploadUrl, {
                method: 'PUT',
                headers: {
                  AccessKey: BUNNY_STORAGE_API_KEY,
                  'Content-Type': 'image/webp',
                },
                body: pngBuffer,
              });

              if (uploadResp.ok) {
                finalImageUrl = `https://mdacula.b-cdn.net/event-images/${fileName}`;
                console.log('[generate-multi-event-article] Imagem Bunny:', finalImageUrl);
              } else {
                console.error('[generate-multi-event-article] Erro upload Bunny:', await uploadResp.text());
              }
            }
          }
        }
      } catch (imageError) {
        console.error('[generate-multi-event-article] Erro na geração de imagem:', imageError);
      }
    }

    let post;
    
    if (isRegeneration && existingPostId) {
      // Update existing post
      console.log('[generate-multi-event-article] Atualizando post existente:', existingPostId);
      
      const { data: updatedPost, error: updateError } = await supabase
        .from('blog_posts')
        .update({
          title: articleData.title,
          excerpt: articleData.excerpt,
          content: articleData.content,
          category: articleData.category || 'Eventos',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPostId)
        .select()
        .single();

      if (updateError) {
        console.error('Erro ao atualizar post:', updateError);
        throw updateError;
      }
      
      post = updatedPost;
      console.log('[generate-multi-event-article] Post atualizado:', post.id);
    } else {
      // Generate unique slug for new post
      const baseSlug = articleData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
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

      // Save new blog post
      const { data: newPost, error: insertError } = await supabase
        .from('blog_posts')
        .insert({
          title: articleData.title,
          slug: slug,
          excerpt: articleData.excerpt,
          content: articleData.content,
          category: articleData.category || 'Eventos',
          published: true,
          published_at: new Date().toISOString(),
          image_url: finalImageUrl
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar post:', insertError);
        throw insertError;
      }
      
      post = newPost;
      console.log('[generate-multi-event-article] Post criado:', post.id);

      // Link all events to this blog post (only for new posts)
      const { error: updateEventsError } = await supabase
        .from('events')
        .update({ blog_post_id: post.id })
        .in('id', eventIds);

      if (updateEventsError) {
        console.error('Erro ao vincular eventos:', updateEventsError);
      } else {
        console.log(`[generate-multi-event-article] ${eventIds.length} eventos vinculados ao post`);
      }
    }

    // Log AI generation
    const { error: aiLogError } = await supabase
      .from('ai_generated_posts')
      .insert({
        blog_post_id: post.id,
        prompt_used: `Multi-Event Article${isRegeneration ? ' (Regenerated)' : ''}: ${seriesName} (${events.length} eventos)`,
        model_used: selectedModel,
        input_tokens: usage.prompt_tokens || null,
        output_tokens: usage.completion_tokens || null,
        total_tokens: usage.total_tokens || null,
        image_tokens: imageTokensUsed > 0 ? imageTokensUsed : null,
      });

    if (aiLogError) {
      console.error('Erro ao registrar log de IA:', aiLogError);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[generate-multi-event-article] Concluído em ${totalTime}ms`);

    return jsonSuccess({ 
      success: true, 
      post: post,
      linkedEvents: eventIds.length,
      message: isRegeneration 
        ? `Artigo regenerado com sucesso!`
        : `Artigo consolidado gerado para ${events.length} eventos!`,
      processingTimeMs: totalTime
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Erro em generate-multi-event-article (${totalTime}ms):`, error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonError('Operação cancelada por timeout. Tente novamente.', 504);
    }
    
    return jsonError(error instanceof Error ? error.message : 'Erro desconhecido', 500);
  }
});
