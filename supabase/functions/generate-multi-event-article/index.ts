import { createClient } from "npm:@supabase/supabase-js@2";
import { sanitizeTitle, validateTitle } from "../_shared/titleSanitizer.ts";
import {
  corsHeaders,
  fetchWithTimeout,
  handleCorsPreFlight,
  jsonError,
  jsonSuccess,
} from "../_shared/generateBlogPostV2/http.ts";
import { logEgress } from "../_shared/generateBlogPostV2/egress.ts";
import { pickRandomStyle } from "../_shared/generateBlogPostV2/imageStyles.ts";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
  buildDatesInfo,
  buildOfficialBlock,
  buildSystemPromptExtras,
  detectImageFormat,
  extractKeywords,
  formatDatePt,
  inferMood,
} from "../_shared/generateMultiEventArticle/prompts.ts";
import { isContentSubstantial } from "../_shared/articleQuality.ts";

// Silencia lint: corsHeaders é reexportado apenas para paridade com bundle anterior.
void corsHeaders;

const FUNCTION_TIMEOUT_MS = 120000; // 120 seconds

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { eventIds, seriesName, additionalContext, generateImage, customImageUrl, existingPostId, publishImmediately } = body;

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
    logEgress(supabase, 'events', events);

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const commonVenue = firstEvent.venue;
    const commonCity = firstEvent.location_city;
    const commonState = firstEvent.location_state;

    const allGenres = [...new Set(events.flatMap(e => e.genres || []))] as string[];
    const existingImageUrl = customImageUrl || events.find(e => e.image_url)?.image_url || null;

    const datesInfo = buildDatesInfo(events);

    const aggregatedAiCtx = events.map(e => e.ai_context || '').join(' ').toLowerCase();
    const isCourtesy = /\b(cortesia|free|gratuito|gratuita|sem venda|sem ingresso|guest list|lista de convidados|open list)\b/.test(aggregatedAiCtx);
    const anyLineup = events.some(e => e.lineup && e.lineup.length > 0);
    const anyEndTime = events.some(e => e.end_time);
    const anyAddress = events.some(e => e.address);

    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['ai_blog_model', 'ai_temperature']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });

    const selectedModel = settingsMap['ai_blog_model'] || 'google/gemini-2.5-flash';
    const temperature = parseFloat(settingsMap['ai_temperature'] || '0.9');

    const { data: template } = await supabase
      .from('ai_prompt_templates')
      .select('system_prompt, user_prompt_template')
      .eq('category', 'Multi-Eventos')
      .eq('enabled', true)
      .eq('is_default', true)
      .maybeSingle();

    const baseSystemPrompt = template?.system_prompt || DEFAULT_SYSTEM_PROMPT;
    const userPromptTemplate = template?.user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

    let userPrompt = userPromptTemplate
      .replace(/\{\{seriesName\}\}/g, seriesName)
      .replace(/\{\{venue\}\}/g, commonVenue)
      .replace(/\{\{city\}\}/g, commonCity)
      .replace(/\{\{state\}\}/g, commonState)
      .replace(/\{\{startDate\}\}/g, formatDatePt(firstEvent.date))
      .replace(/\{\{endDate\}\}/g, formatDatePt(lastEvent.date))
      .replace(/\{\{genres\}\}/g, allGenres.join(', ') || 'Música Eletrônica')
      .replace(/\{\{dates\}\}/g, datesInfo)
      .replace(/\{\{additionalContext\}\}/g, additionalContext ? `## CONTEXTO ADICIONAL:\n${additionalContext}` : '');

    userPrompt = buildOfficialBlock({
      seriesName,
      commonVenue,
      commonCity,
      commonState,
      firstDate: firstEvent.date,
      lastDate: lastEvent.date,
      genres: allGenres,
      datesInfo,
    }) + userPrompt;

    const systemPrompt = baseSystemPrompt + buildSystemPromptExtras({
      anyLineup,
      anyEndTime,
      anyAddress,
      isCourtesy,
    });

    console.log('[generate-multi-event-article] Usando template:', template ? 'do banco' : 'fallback padrão', '| isCourtesy:', isCourtesy);

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

    const isGpt5 = isOpenAIModel && modelName.startsWith('gpt-5');

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
        ...(isGpt5 ? { reasoning_effort: 'minimal', verbosity: 'high' } : {}),
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
      console.error('Conteúdo recebido:', generatedContent.substring(0, 500));
      throw new Error('IA não retornou JSON válido');
    }

    if (!articleData.title || !articleData.content) {
      throw new Error('IA não gerou dados completos');
    }

    const titleCheck = validateTitle(articleData.title);
    if (!titleCheck.valid) {
      console.warn('[generate-multi-event-article] Título com issues:', titleCheck.issues, '| original:', articleData.title);
    }
    articleData.title = sanitizeTitle(titleCheck.cleaned);

    let finalImageUrl = existingImageUrl;
    let imageTokensUsed = 0;

    const timeForImage = FUNCTION_TIMEOUT_MS - (Date.now() - startTime);

    if (generateImage && !finalImageUrl && !isRegeneration && timeForImage > 35000) {
      try {
        console.log('[generate-multi-event-article] Gerando imagem com estilo variado...');

        const imgKeywords = extractKeywords(articleData.content || '');
        const imgMood = inferMood(articleData.content || '', seriesName);
        const style = await pickRandomStyle(supabase);

        const imagePrompt = style.prompt
          .replace(/\{\{title\}\}/g, seriesName)
          .replace(/\{\{summary\}\}/g, articleData.excerpt || '')
          .replace(/\{\{category\}\}/g, 'Eventos')
          .replace(/\{\{keywords\}\}/g, imgKeywords)
          .replace(/\{\{mood\}\}/g, imgMood)
          .replace(/\{\{visualElements\}\}/g, `${commonVenue}, ${commonCity}, ${allGenres.join(', ')}`);

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

            const { fileExt, contentType } = detectImageFormat(pngBuffer);
            const fileName = `multi-event-${Date.now()}.${fileExt}`;

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
                body: pngBuffer,
              });

              if (uploadResp.ok) {
                finalImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
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

      // Item #2 (reorganização dos controles de publicação, 10/08/2026): rede
      // de segurança extra — mesmo com o toggle ligado, um artigo raso nunca
      // vai ao ar sozinho, cai como rascunho pra revisão.
      const substantial = isContentSubstantial(articleData.content);
      const willPublish = publishImmediately !== false && substantial;
      if (publishImmediately !== false && !substantial) {
        console.warn(`[generate-multi-event-article] Conteúdo curto demais — publicação automática cancelada, nasce como rascunho: "${articleData.title}"`);
      }

      const { data: newPost, error: insertError } = await supabase
        .from('blog_posts')
        .insert({
          title: articleData.title,
          slug: slug,
          excerpt: articleData.excerpt,
          content: articleData.content,
          category: articleData.category || 'Eventos',
          published: willPublish,
          published_at: willPublish ? new Date().toISOString() : null,
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
        generation_source: 'multi_evento',
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
