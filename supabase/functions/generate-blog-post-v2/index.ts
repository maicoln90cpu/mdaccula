import { createClient } from "npm:@supabase/supabase-js@2";

import { sanitizeTitle, validateTitle } from "../_shared/titleSanitizer.ts";
import { shouldScrapeForContext } from "../_shared/scrapeGate.ts";
import { searchWithFirecrawl } from "../_shared/firecrawlSearch.ts";
import { shouldRequireSourceVerification, buildGuardrailSearchQuery } from "../_shared/eventSourceGuardrail.ts";


// ============= HELPERS EXTRAÍDOS PARA _shared/generateBlogPostV2 (Ondas 6 e 22) =============
// Os módulos abaixo foram separados do index.ts para manter este arquivo
// abaixo de 600 linhas. Comportamento preservado 1:1 — se editar, replique
// o teste correspondente em src/__tests__/regression/ ou supabase/functions/_shared/*_test.ts.
import { logEgress } from "../_shared/generateBlogPostV2/egress.ts";
import { handleCorsPreFlight, jsonSuccess, jsonError, fetchWithTimeout, scrapeWithFirecrawl } from "../_shared/generateBlogPostV2/http.ts";
import { extractKeywords, inferMood } from "../_shared/generateBlogPostV2/contentAnalysis.ts";
import { replaceVariables, FAKE_DOMAINS, restrictLinkToFirstMention, removeFakeLinks } from "../_shared/generateBlogPostV2/textUtils.ts";
import { generateAndAttachImage } from "../_shared/generateBlogPostV2/imageGeneration.ts";
import { computeWeekday, computeDateFormatted } from "../_shared/generateBlogPostV2/dateHelpers.ts";
import { applyTemplateVariables, buildOfficialDataBlock, buildSystemPrompt } from "../_shared/generateBlogPostV2/promptBuilder.ts";
import { generateUniqueSlug, saveOrUpdatePost, logAiGeneration } from "../_shared/generateBlogPostV2/savePost.ts";

const FUNCTION_TIMEOUT_MS = 140000; // 140 seconds - margem de segurança de 10s


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

    // Garantir weekday/dateFormatted mesmo quando o caller não envia
    if (formFields.eventDate && !formFields.weekday) {
      formFields.weekday = computeWeekday(String(formFields.eventDate));
    }
    if (formFields.eventDate && !formFields.dateFormatted) {
      formFields.dateFormatted = computeDateFormatted(String(formFields.eventDate));
    }

    // Substituir variáveis no user_prompt_template
    let userPrompt = applyTemplateVariables(template.user_prompt_template, formFields);

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
    const officialDataBlock = buildOfficialDataBlock(formFields, isEventMode);
    if (officialDataBlock) userPrompt = officialDataBlock + userPrompt;

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

    // Adicionar instrução de tamanho máximo + regras de título ao system prompt
    const systemPromptWithLength = buildSystemPrompt({
      templateSystemPrompt: template.system_prompt,
      maxArticleLength,
      isEventMode,
      hasRealTicketLink: Boolean(hasRealTicketLink),
      isCourtesy,
      formFields,
      aiContextBlock,
    });
    
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
