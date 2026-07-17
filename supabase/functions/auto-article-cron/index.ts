import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
const SUGGESTIONS_TIMEOUT_MS = 150000; // 2.5 minutos para sugestões (AUMENTADO)
const GENERATE_TIMEOUT_MS = 180000; // 3 minutos para geração de artigo
const MAX_CONSECUTIVE_FAILURES = 5;
const RETRY_INTERVAL_HOURS = 1;

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Variáveis de ambiente faltando');
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
        'suggestions_auto_publish'
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });
    logEgress(supabase, 'site_settings', settings);

    const autoGenerateEnabled = settingsMap['ai_auto_generate_enabled'] === 'true';
    const intervalHours = parseInt(settingsMap['ai_auto_generate_interval_hours'] || '24');
    const lastRun = settingsMap['ai_auto_generate_last_run'] ? new Date(settingsMap['ai_auto_generate_last_run']) : null;
    const failCount = parseInt(settingsMap['ai_auto_generate_fail_count'] || '0');
    // Ausente -> false: artigos de Sugestões nascem como rascunho até o usuário
    // ganhar confiança e ligar a publicação automática (mesmo padrão de
    // event_watcher_auto_publish).
    const suggestionsAutoPublish = settingsMap['suggestions_auto_publish'] === 'true';

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

    // ========== ETAPA 1: GERAR SUGESTÕES ==========
    console.log(`[Etapa 1] Chamando generate-blog-suggestions (timeout: ${SUGGESTIONS_TIMEOUT_MS}ms = ${SUGGESTIONS_TIMEOUT_MS/1000}s)...`);
    const suggestionsStartTime = Date.now();
    
    let suggestionsResponse: Response;
    try {
      suggestionsResponse = await fetchWithTimeout(
        `${SUPABASE_URL}/functions/v1/generate-blog-suggestions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        SUGGESTIONS_TIMEOUT_MS
      );
    } catch (fetchError) {
      const elapsed = Date.now() - suggestionsStartTime;
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Erro desconhecido';
      const isTimeout = errorMsg.includes('abort') || errorMsg.includes('Abort');
      console.error(`[Etapa 1] FALHA após ${elapsed}ms: ${isTimeout ? 'TIMEOUT' : errorMsg}`);
      await logToDb(supabase, 'error', 'suggestions-fetch-failed', { error: errorMsg, isTimeout, elapsedMs: elapsed });
      await incrementFailCount(supabase, failCount);
      return;
    }

    const suggestionsElapsed = Date.now() - suggestionsStartTime;
    console.log(`[Etapa 1] Resposta recebida em ${suggestionsElapsed}ms`);

    if (!suggestionsResponse.ok) {
      const errorText = await suggestionsResponse.text();
      console.error('[Etapa 1] FALHA HTTP:', suggestionsResponse.status, errorText.substring(0, 300));
      await logToDb(supabase, 'error', 'suggestions-api-error', { status: suggestionsResponse.status, response: errorText.substring(0, 500), elapsedMs: suggestionsElapsed });
      await incrementFailCount(supabase, failCount);
      return;
    }

    const suggestionsData = await suggestionsResponse.json();
    const suggestions = suggestionsData.suggestions;

    if (!suggestions || suggestions.length === 0) {
      console.error('[Etapa 1] FALHA: Nenhuma sugestão retornada');
      await logToDb(supabase, 'error', 'no-suggestions', { response: suggestionsData, elapsedMs: suggestionsElapsed });
      await incrementFailCount(supabase, failCount);
      return;
    }

    const selectedSuggestion = suggestions[0];
    console.log(`[Etapa 1] SUCESSO em ${suggestionsElapsed}ms: Selecionada sugestão "${selectedSuggestion.title}"`);
    console.log(`[Etapa 1] Breakdown: scrape=${suggestionsData.breakdown?.scrapeMs || 'N/A'}ms, ai=${suggestionsData.breakdown?.aiMs || 'N/A'}ms`);

    // ========== ETAPA 2: GERAR ARTIGO (ancorado em busca real, não mais opinativo) ==========
    console.log(`[Etapa 2] Chamando generate-blog-post-from-topic (timeout: ${GENERATE_TIMEOUT_MS}ms = ${GENERATE_TIMEOUT_MS/1000}s)...`);
    const generateStartTime = Date.now();
    const searchQuery = selectedSuggestion.searchQuery || selectedSuggestion.title;

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
            query: searchQuery,
            generateImage: true,
            publishImmediately: suggestionsAutoPublish,
          }),
        },
        GENERATE_TIMEOUT_MS
      );
    } catch (fetchError) {
      const elapsed = Date.now() - generateStartTime;
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Erro desconhecido';
      const isTimeout = errorMsg.includes('abort') || errorMsg.includes('Abort');
      console.error(`[Etapa 2] FALHA após ${elapsed}ms: ${isTimeout ? 'TIMEOUT' : errorMsg}`);
      await logToDb(supabase, 'error', 'generate-fetch-failed', { error: errorMsg, isTimeout, suggestion: selectedSuggestion.title, elapsedMs: elapsed });
      await incrementFailCount(supabase, failCount);
      return;
    }

    const generateElapsed = Date.now() - generateStartTime;
    console.log(`[Etapa 2] Resposta recebida em ${generateElapsed}ms`);

    // "Nenhuma fonte encontrada" não é uma falha do sistema — é um dia sem
    // notícia real ancorável para essa sugestão. Não conta pro contador de
    // falhas consecutivas (que pausaria o auto-generate por 24h à toa).
    if (generateResponse.status === 404) {
      const errorText = await generateResponse.text();
      console.log('[Etapa 2] SKIP (sem fontes reais):', errorText.substring(0, 300));
      await logToDb(supabase, 'info', 'skipped-no-sources', { query: searchQuery, suggestion: selectedSuggestion.title, elapsedMs: generateElapsed });
      return;
    }

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('[Etapa 2] FALHA HTTP:', generateResponse.status, errorText.substring(0, 300));
      await logToDb(supabase, 'error', 'generate-api-error', { status: generateResponse.status, response: errorText.substring(0, 500), suggestion: selectedSuggestion.title, elapsedMs: generateElapsed });
      await incrementFailCount(supabase, failCount);
      return;
    }

    const generateData = await generateResponse.json();

    if (!generateData.post?.id) {
      console.error('[Etapa 2] FALHA: Artigo não foi criado:', generateData);
      await logToDb(supabase, 'error', 'post-not-created', { response: generateData, suggestion: selectedSuggestion.title, elapsedMs: generateElapsed });
      await incrementFailCount(supabase, failCount);
      return;
    }

    // ========== SUCESSO ==========
    const totalElapsed = suggestionsElapsed + generateElapsed;
    console.log('=== ARTIGO AUTO-GERADO COM SUCESSO ===');
    console.log(`Post ID: ${generateData.post?.id}`);
    console.log(`Título: ${generateData.post?.title}`);
    console.log(`Tempo total: ${totalElapsed}ms (sugestões: ${suggestionsElapsed}ms, geração: ${generateElapsed}ms)`);

    await updateLastRun(supabase, now);
    await resetFailCount(supabase);

    await logToDb(supabase, 'info', 'success', { 
      postId: generateData.post?.id, 
      title: generateData.post?.title,
      previousFailCount: failCount,
      totalElapsedMs: totalElapsed,
      suggestionsElapsedMs: suggestionsElapsed,
      generateElapsedMs: generateElapsed
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
        suggestionsMs: SUGGESTIONS_TIMEOUT_MS,
        generateMs: GENERATE_TIMEOUT_MS
      }
    });

  } catch (error) {
    return handleError(error, 'auto-article-cron');
  }
});
