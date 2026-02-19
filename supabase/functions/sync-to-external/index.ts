import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

const FUNCTION_TIMEOUT_MS = 25000; // 25 seconds timeout
const TABLE_TIMEOUT_MS = 5000; // 5 seconds per table

interface SyncResult {
  table: string;
  records: number;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const logId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Clientes Supabase
    const localUrl = Deno.env.get('SUPABASE_URL')!;
    const localKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const localSupabase = createClient(localUrl, localKey);

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY')!;
    const externalSupabase = createClient(externalUrl, externalKey);

    console.log(`[${logId}] Iniciando sincronização...`);

    // Criar log inicial
    const reqBody = await req.json().catch(() => ({}));
    await localSupabase.from('sync_logs').insert({
      id: logId,
      status: 'running',
      triggered_by: reqBody?.triggered_by || 'manual',
      started_at: new Date().toISOString(),
    });

    const results: SyncResult[] = [];
    let totalRecords = 0;

    // Tabelas em ordem de dependência
    const tables = [
      'profiles',
      'user_roles',
      'team_members',
      'link_groups',
      'custom_links',
      'events',
      'blog_posts',
      'blog_post_likes',
      'ai_prompt_templates',
      'ai_generated_posts',
      'news_sources',
      'newsletter_popup_variants',
      'newsletter_subscribers',
      'newsletter_popup_analytics',
      'share_analytics',
      'site_settings',
    ];

    // Sincronizar cada tabela com timeout
    for (const table of tables) {
      // Check if we're running out of time
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > FUNCTION_TIMEOUT_MS - 3000) {
        console.log(`[${logId}] ⚠️ Tempo esgotando, pulando tabelas restantes`);
        results.push({
          table,
          records: 0,
          success: false,
          error: 'Skipped due to timeout',
        });
        continue;
      }

      try {
        console.log(`[${logId}] 🔄 INICIANDO sync de: ${table}`);
        
        // Fetch local data with timeout
        const { data: localData, error: fetchError } = await withTimeout(
          localSupabase.from(table).select('*'),
          TABLE_TIMEOUT_MS
        );

        if (fetchError) {
          console.error(`[${logId}] ❌ ERRO ao buscar ${table}:`, JSON.stringify(fetchError, null, 2));
          throw new Error(`Erro ao buscar ${table}: ${fetchError.message}`);
        }
        
        console.log(`[${logId}] ✅ Dados locais obtidos: ${localData?.length || 0} registros`);

        if (!localData || localData.length === 0) {
          console.log(`[${logId}] ⚠️ Tabela ${table} vazia, pulando...`);
          results.push({ table, records: 0, success: true });
          continue;
        }

        // Upsert to external with timeout
        console.log(`[${logId}] 📤 Enviando ${localData.length} registros para banco EXTERNO...`);
        
        const { error: upsertError } = await withTimeout(
          externalSupabase.from(table).upsert(localData, { onConflict: 'id' }),
          TABLE_TIMEOUT_MS
        );

        if (upsertError) {
          console.error(`[${logId}] ❌ ERRO DETALHADO ao inserir em ${table}:`, {
            message: upsertError.message,
            details: upsertError.details,
            hint: upsertError.hint,
            code: upsertError.code,
          });
          throw new Error(`Erro ao inserir em ${table}: ${upsertError.message}`);
        }

        console.log(`[${logId}] ✅ ${table}: ${localData.length} registros sincronizados com sucesso`);
        results.push({ table, records: localData.length, success: true });
        totalRecords += localData.length;
      } catch (error) {
        console.error(`[${logId}] ✗ Erro em ${table}:`, error);
        results.push({
          table,
          records: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    // Sincronizar Storage (apenas metadados)
    let storageFilesSynced = 0;
    const storageBuckets = ['event-images', 'team-images', 'link-thumbnails'];
    
    for (const bucket of storageBuckets) {
      try {
        const { data: files, error: listError } = await withTimeout(
          localSupabase.storage.from(bucket).list(),
          3000
        );

        if (!listError && files) {
          storageFilesSynced += files.length;
          console.log(`[${logId}] Bucket ${bucket}: ${files.length} arquivos detectados`);
        }
      } catch (error) {
        console.error(`[${logId}] Erro ao listar bucket ${bucket}:`, error);
      }
    }

    // Calcular duração
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Determinar status final
    const hasErrors = results.some(r => !r.success);
    const finalStatus = hasErrors ? 'warning' : 'success';

    // Atualizar log final
    await localSupabase.from('sync_logs').update({
      completed_at: new Date().toISOString(),
      status: finalStatus,
      tables_synced: results,
      total_records: totalRecords,
      storage_files_synced: storageFilesSynced,
      duration_seconds: durationSeconds,
      errors: results.filter(r => !r.success).map(r => ({
        table: r.table,
        error: r.error,
      })),
    }).eq('id', logId);

    console.log(`[${logId}] Sincronização concluída em ${durationSeconds}s`);
    console.log(`[${logId}] Total: ${totalRecords} registros, Status: ${finalStatus}`);

    return jsonSuccess({
      success: true,
      logId,
      totalRecords,
      storageFilesSynced,
      durationSeconds,
      status: finalStatus,
      results,
    });
  } catch (error) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.error(`[${logId}] Erro fatal após ${durationSeconds}s:`, error);
    
    // Tentar atualizar log com erro
    try {
      const localUrl = Deno.env.get('SUPABASE_URL')!;
      const localKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const localSupabase = createClient(localUrl, localKey);
      
      await localSupabase.from('sync_logs').update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: [{ error: error instanceof Error ? error.message : 'Erro desconhecido' }],
        duration_seconds: durationSeconds,
      }).eq('id', logId);
    } catch (logError) {
      console.error('Erro ao atualizar log:', logError);
    }

    return jsonError(error instanceof Error ? error.message : 'Erro desconhecido', 500);
  }
});
