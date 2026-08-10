import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { discoverArticleUrls, fetchSourceLinks, findListingIndexUrls, type SourceRef } from "../_shared/sourceArticlePicker.ts";

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

// ============= CONSTANTS =============
const GENERATE_TIMEOUT_MS = 180000; // 3 minutos para geração de artigo
const MAX_CONSECUTIVE_FAILURES = 5;
const RETRY_INTERVAL_HOURS = 1;
const MAX_SOURCE_ATTEMPTS = 3; // quantas fontes tentar até achar candidatos
const CANDIDATES_PER_SOURCE = 3; // quantos candidatos levar de cada fonte pra fila de tentativas
const MAX_GENERATE_ATTEMPTS = 6; // total de tentativas de geração (não só de fontes) numa execução

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

// Helper para logar no banco
async function logToDb(supabase: ReturnType<typeof createClient>, level: string, type: string, context: Record<string, unknown>) {
  try {
    await supabase.from('application_logs').insert({
      level,
      message: `Auto-geração: ${type}`,
      context,
    });
  } catch (e) {
    console.error('Falha ao salvar log:', e);
  }
}

// Helper para incrementar contador de falhas
async function incrementFailCount(supabase: ReturnType<typeof createClient>, currentCount: number): Promise<void> {
  await supabase
    .from('site_settings')
    .upsert({ 
      key: 'ai_auto_generate_fail_count', 
      value: String(currentCount + 1) 
    }, { onConflict: 'key' });
}

// Helper para resetar contador de falhas
async function resetFailCount(supabase: ReturnType<typeof createClient>): Promise<void> {
  await supabase
    .from('site_settings')
    .upsert({ 
      key: 'ai_auto_generate_fail_count', 
      value: '0' 
    }, { onConflict: 'key' });
}

// Helper para atualizar last_run após sucesso
async function updateLastRun(supabase: ReturnType<typeof createClient>, timestamp: Date): Promise<void> {
  await supabase
    .from('site_settings')
    .upsert({ 
      key: 'ai_auto_generate_last_run', 
      value: timestamp.toISOString() 
    }, { onConflict: 'key' });
}

// Função principal de geração que será executada em background
async function runAutoGeneration() {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Variáveis de ambiente faltando');
    return;
  }
  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY faltando — necessária para descobrir matérias reais das fontes');
    return;
  }

  console.log('=== AUTO-GENERATE-ARTICLE BACKGROUND TASK INICIADO ===');
  console.log('Timestamp:', new Date().toISOString());

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Buscar configurações de auto-geração
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'ai_auto_generate_enabled',
        'ai_auto_generate_interval_hours',
        'ai_auto_generate_last_run',
        'ai_auto_generate_fail_count',
        'auto_publish_auto_cron'
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });
    logEgress(supabase, 'site_settings', settings);

    const autoGenerateEnabled = settingsMap['ai_auto_generate_enabled'] === 'true';
    const intervalHours = parseInt(settingsMap['ai_auto_generate_interval_hours'] || '24');
    const lastRun = settingsMap['ai_auto_generate_last_run'] ? new Date(settingsMap['ai_auto_generate_last_run']) : null;
    const failCount = parseInt(settingsMap['ai_auto_generate_fail_count'] || '0');
    // Item #7 (reorganização dos controles de publicação, 10/08/2026): chave
    // própria do automático — antes compartilhava 'suggestions_auto_publish'
    // com o caminho manual "Sugestões→tema", sem controle independente por
    // tipo. Ausente -> false: artigo nasce como rascunho até o usuário ganhar
    // confiança e ligar a publicação automática (mesmo padrão de
    // event_watcher_auto_publish).
    const autoCronAutoPublish = settingsMap['auto_publish_auto_cron'] === 'true';

    console.log('Configurações:', { autoGenerateEnabled, intervalHours, lastRun: lastRun?.toISOString(), failCount });

    // Verificar se auto-geração está habilitada
    if (!autoGenerateEnabled) {
      console.log('Auto-geração desabilitada, pulando...');
      await logToDb(supabase, 'info', 'skipped-disabled', {});
      return;
    }

    // Verificar se há muitas falhas consecutivas
    if (failCount >= MAX_CONSECUTIVE_FAILURES) {
      const now = new Date();
      if (lastRun) {
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun >= 24) {
          console.log('24h passaram, resetando contador de falhas...');
          await resetFailCount(supabase);
        } else {
          console.log(`Sistema pausado após ${failCount} falhas. Próxima tentativa em ${(24 - hoursSinceLastRun).toFixed(2)} horas`);
          await logToDb(supabase, 'warn', 'skipped-paused', { failCount, hoursRemaining: 24 - hoursSinceLastRun });
          return;
        }
      }
    }

    // Calcular intervalo efetivo
    const effectiveInterval = failCount > 0 ? RETRY_INTERVAL_HOURS : intervalHours;

    // Verificar se já passou o intervalo
    const now = new Date();
    if (lastRun) {
      const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      console.log(`Horas desde última execução: ${hoursSinceLastRun.toFixed(2)}, intervalo: ${effectiveInterval}h`);
      
      if (hoursSinceLastRun < effectiveInterval) {
        console.log(`Ainda não passou o intervalo. Próxima em ${(effectiveInterval - hoursSinceLastRun).toFixed(2)}h`);
        return;
      }
    }

    console.log('Iniciando geração automática de artigo...');
    await logToDb(supabase, 'info', 'started', { failCount });

    // ========== ETAPA 1: MONTAR FILA DE CANDIDATOS (VÁRIAS FONTES/MATÉRIAS) ==========
    // Fase 1 da correção de "geração por tema" (R-048): em vez de gerar
    // "sugestões" a partir de homepages inteiras (o que produzia artigos
    // institucionais sobre a própria fonte), descobre matérias individuais
    // reais dentro do domínio de cada fonte cadastrada.
    //
    // Hotfix nº4 (achado em produção, 09/08/2026): pegar só 1 candidato e
    // desistir da execução inteira se ele der 422 (ex.: Play BPM escolheu uma
    // página de "lançamentos da semana" — um roundup de vários itens, não 1
    // notícia específica — e a IA recusou, corretamente, mas isso significava
    // "nenhum artigo saiu" de novo). Agora monta uma FILA com vários
    // candidatos (várias fontes × várias matérias por fonte) e tenta gerar em
    // cada um até o primeiro sucesso real, em vez de 1 tentativa = 1 execução.
    console.log('[Etapa 1] Montando fila de candidatos (fonte + matéria real ainda não usada)...');
    const etapa1StartTime = Date.now();

    const { data: sitesSources, error: sitesSourcesError } = await supabase
      .from('event_sources')
      .select('name, url')
      .eq('type', 'site')
      .eq('enabled', true)
      .eq('content_source', true);

    if (sitesSourcesError || !sitesSources || sitesSources.length === 0) {
      console.error('[Etapa 1] FALHA: Nenhuma fonte tipo "site" habilitada como content_source em event_sources');
      await logToDb(supabase, 'error', 'no-sources-configured', { error: sitesSourcesError?.message, elapsedMs: Date.now() - etapa1StartTime });
      await incrementFailCount(supabase, failCount);
      return;
    }

    const { data: usedSourcesRows } = await supabase
      .from('ai_generated_posts')
      .select('source_urls')
      .not('source_urls', 'is', null);
    const usedUrls = (usedSourcesRows || []).flatMap((r) => (Array.isArray(r.source_urls) ? r.source_urls : []));

    const shuffledSources = [...sitesSources].sort(() => Math.random() - 0.5);
    const sourcesToTry = shuffledSources.slice(0, MAX_SOURCE_ATTEMPTS);

    const attemptQueue: { source: SourceRef; url: string }[] = [];

    for (const source of sourcesToTry) {
      try {
        const links = await fetchSourceLinks(source.url, FIRECRAWL_API_KEY);
        let candidates = discoverArticleUrls(source, links, usedUrls);
        console.log(`[Etapa 1] Fonte "${source.name}": ${links.length} links, ${candidates.length} candidatos novos`);

        // Segundo hop (R-048, achado em produção): a raiz de várias fontes só
        // linka pra páginas de listagem (ex.: "/noticias/" no menu), sem
        // nenhuma matéria individual diretamente visível. Se não achou
        // candidato na raiz, tenta raspar até 2 dessas páginas de listagem
        // em busca de links de matéria de verdade.
        if (candidates.length === 0) {
          const listingUrls = findListingIndexUrls(source, links);
          for (const listingUrl of listingUrls.slice(0, 2)) {
            const deeperLinks = await fetchSourceLinks(listingUrl, FIRECRAWL_API_KEY);
            candidates = discoverArticleUrls(source, deeperLinks, usedUrls);
            console.log(`[Etapa 1] Fonte "${source.name}" — 2º hop em ${listingUrl}: ${deeperLinks.length} links, ${candidates.length} candidatos novos`);
            if (candidates.length > 0) break;
          }
        }

        for (const url of candidates.slice(0, CANDIDATES_PER_SOURCE)) {
          attemptQueue.push({ source, url });
        }
      } catch (discoveryError) {
        console.error(`[Etapa 1] Falha ao descobrir links de "${source.name}":`, discoveryError);
      }
    }

    const etapa1Elapsed = Date.now() - etapa1StartTime;

    // Nenhuma matéria nova encontrada nas fontes tentadas não é uma falha do
    // sistema — é um dia sem novidade real nessas fontes. Não conta pro
    // contador de falhas consecutivas (que pausaria o auto-generate à toa).
    if (attemptQueue.length === 0) {
      console.log(`[Etapa 1] SKIP: nenhuma matéria nova encontrada em ${sourcesToTry.length} fonte(s) tentada(s)`);
      await logToDb(supabase, 'info', 'skipped-no-new-articles', {
        sourcesTried: sourcesToTry.map((s) => s.name),
        elapsedMs: etapa1Elapsed,
      });
      return;
    }

    console.log(`[Etapa 1] SUCESSO em ${etapa1Elapsed}ms: ${attemptQueue.length} candidato(s) na fila, de ${new Set(attemptQueue.map((a) => a.source.name)).size} fonte(s)`);

    // ========== ETAPA 2: TENTAR REESCREVER, CANDIDATO A CANDIDATO ==========
    const skipped: { source: string; url: string; status: number }[] = [];
    let generateElapsedTotal = 0;

    for (const { source: pickedSource, url: pickedArticleUrl } of attemptQueue.slice(0, MAX_GENERATE_ATTEMPTS)) {
      console.log(`[Etapa 2] Tentando "${pickedSource.name}" — ${pickedArticleUrl} (timeout: ${GENERATE_TIMEOUT_MS}ms = ${GENERATE_TIMEOUT_MS/1000}s)...`);
      const generateStartTime = Date.now();

      let generateResponse: Response;
      try {
        generateResponse = await fetchWithTimeout(
          `${SUPABASE_URL}/functions/v1/generate-blog-post-from-topic`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mode: 'source_article',
              sourceUrl: pickedArticleUrl,
              sourceName: pickedSource.name,
              generateImage: true,
              publishImmediately: autoCronAutoPublish,
            }),
          },
          GENERATE_TIMEOUT_MS
        );
      } catch (fetchError) {
        const elapsed = Date.now() - generateStartTime;
        generateElapsedTotal += elapsed;
        const errorMsg = fetchError instanceof Error ? fetchError.message : 'Erro desconhecido';
        const isTimeout = errorMsg.includes('abort') || errorMsg.includes('Abort');
        console.error(`[Etapa 2] FALHA após ${elapsed}ms: ${isTimeout ? 'TIMEOUT' : errorMsg}`);
        await logToDb(supabase, 'error', 'generate-fetch-failed', { error: errorMsg, isTimeout, sourceUrl: pickedArticleUrl, elapsedMs: elapsed });
        await incrementFailCount(supabase, failCount);
        return;
      }

      const generateElapsed = Date.now() - generateStartTime;
      generateElapsedTotal += generateElapsed;
      console.log(`[Etapa 2] Resposta recebida em ${generateElapsed}ms (status ${generateResponse.status})`);

      // 404 (scrape da matéria falhou) e 422 (matéria era só institucional/
      // roundup de vários itens, sem 1 notícia específica) não são falhas do
      // sistema — são um resultado legítimo de "essa matéria específica não
      // deu certo". Não conta pro contador de falhas consecutivas. Em vez de
      // desistir da execução, tenta o próximo candidato da fila.
      if (generateResponse.status === 404 || generateResponse.status === 422) {
        const errorText = await generateResponse.text();
        console.log(`[Etapa 2] SKIP (status ${generateResponse.status}), tentando próximo candidato:`, errorText.substring(0, 300));
        skipped.push({ source: pickedSource.name, url: pickedArticleUrl, status: generateResponse.status });
        continue;
      }

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        console.error('[Etapa 2] FALHA HTTP:', generateResponse.status, errorText.substring(0, 300));
        await logToDb(supabase, 'error', 'generate-api-error', { status: generateResponse.status, response: errorText.substring(0, 500), sourceUrl: pickedArticleUrl, elapsedMs: generateElapsed });
        await incrementFailCount(supabase, failCount);
        return;
      }

      const generateData = await generateResponse.json();

      if (!generateData.post?.id) {
        console.error('[Etapa 2] FALHA: Artigo não foi criado:', generateData);
        await logToDb(supabase, 'error', 'post-not-created', { response: generateData, sourceUrl: pickedArticleUrl, elapsedMs: generateElapsed });
        await incrementFailCount(supabase, failCount);
        return;
      }

      // ========== SUCESSO ==========
      const totalElapsed = etapa1Elapsed + generateElapsedTotal;
      console.log('=== ARTIGO AUTO-GERADO COM SUCESSO ===');
      console.log(`Post ID: ${generateData.post?.id}`);
      console.log(`Título: ${generateData.post?.title}`);
      console.log(`Fonte: "${pickedSource.name}" — ${pickedArticleUrl}`);
      console.log(`Candidatos pulados antes do sucesso: ${skipped.length}`);
      console.log(`Tempo total: ${totalElapsed}ms (fila: ${etapa1Elapsed}ms, geração: ${generateElapsedTotal}ms)`);

      await updateLastRun(supabase, now);
      await resetFailCount(supabase);

      await logToDb(supabase, 'info', 'success', {
        postId: generateData.post?.id,
        title: generateData.post?.title,
        sourceName: pickedSource.name,
        sourceUrl: pickedArticleUrl,
        skippedCandidates: skipped,
        previousFailCount: failCount,
        totalElapsedMs: totalElapsed,
        sourcePickElapsedMs: etapa1Elapsed,
        generateElapsedMs: generateElapsedTotal
      });
      return;
    }

    // Fila inteira tentada, nenhum candidato virou artigo — não é falha do
    // sistema (cada um foi uma recusa legítima), mas precisa ficar visível
    // que a execução não produziu nada, com o detalhe de cada tentativa.
    console.log(`[Etapa 2] SKIP: ${skipped.length} candidato(s) tentado(s), nenhum virou artigo`);
    await logToDb(supabase, 'info', 'skipped-all-candidates-unusable', {
      attempted: skipped,
      elapsedMs: etapa1Elapsed + generateElapsedTotal,
    });

  } catch (error) {
    console.error('=== ERRO INESPERADO NA AUTO-GERAÇÃO ===', error);
    await logToDb(supabase, 'error', 'unexpected-error', { 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
    
    // Incrementar fail count
    const { data: failSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'ai_auto_generate_fail_count')
      .single();
    
    const currentFailCount = parseInt(failSetting?.value || '0');
    await incrementFailCount(supabase, currentFailCount);
  }
}

// Handler principal - responde imediatamente e executa em background
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError('Configuração de ambiente incompleta', 500);
    }

    console.log('=== AUTO-ARTICLE-CRON CHAMADO ===');
    console.log('Timestamp:', new Date().toISOString());

    // Verificar se deve executar (checagem rápida)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'ai_auto_generate_enabled', 
        'ai_auto_generate_interval_hours', 
        'ai_auto_generate_last_run',
        'ai_auto_generate_fail_count'
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });

    const autoGenerateEnabled = settingsMap['ai_auto_generate_enabled'] === 'true';
    const intervalHours = parseInt(settingsMap['ai_auto_generate_interval_hours'] || '24');
    const lastRun = settingsMap['ai_auto_generate_last_run'] ? new Date(settingsMap['ai_auto_generate_last_run']) : null;
    const failCount = parseInt(settingsMap['ai_auto_generate_fail_count'] || '0');

    if (!autoGenerateEnabled) {
      return jsonSuccess({ 
        success: true, 
        message: 'Auto-geração desabilitada', 
        skipped: true 
      });
    }

    // Verificar se está pausado por falhas
    if (failCount >= MAX_CONSECUTIVE_FAILURES) {
      const now = new Date();
      if (lastRun) {
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun < 24) {
          return jsonSuccess({ 
            success: true, 
            message: `Sistema pausado após ${failCount} falhas consecutivas`, 
            skipped: true,
            paused: true,
            failCount,
            nextRetryIn: `${(24 - hoursSinceLastRun).toFixed(2)} horas`
          });
        }
      }
    }

    // Verificar se passou o intervalo
    const effectiveInterval = failCount > 0 ? RETRY_INTERVAL_HOURS : intervalHours;
    const now = new Date();
    
    if (lastRun) {
      const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < effectiveInterval) {
        return jsonSuccess({ 
          success: true, 
          message: `Próxima execução em ${(effectiveInterval - hoursSinceLastRun).toFixed(2)} horas`, 
          skipped: true,
          hoursSinceLastRun: hoursSinceLastRun.toFixed(2),
          nextRunIn: `${(effectiveInterval - hoursSinceLastRun).toFixed(2)} horas`,
          failCount,
          isRetrying: failCount > 0
        });
      }
    }

    // Executar geração em background usando EdgeRuntime.waitUntil
    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(runAutoGeneration());
      console.log('Geração iniciada em background via EdgeRuntime.waitUntil');
    } else {
      // Fallback: executar diretamente
      console.log('EdgeRuntime.waitUntil não disponível, executando diretamente...');
      runAutoGeneration().catch(e => console.error('Erro no background:', e));
    }

    return jsonSuccess({ 
      success: true, 
      message: 'Geração automática iniciada em background',
      startedAt: now.toISOString(),
      failCount,
      isRetry: failCount > 0,
      timeouts: {
        generateMs: GENERATE_TIMEOUT_MS
      }
    });

  } catch (error) {
    return handleError(error, 'auto-article-cron');
  }
});
