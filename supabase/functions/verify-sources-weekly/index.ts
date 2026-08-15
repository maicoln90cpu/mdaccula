/**
 * Item #10 (reorganização dos controles de geração de conteúdo, 10/08/2026):
 * checagem semanal, sem gerar nem publicar nada, de que cada fonte
 * `content_source=true` ainda tem pelo menos 1 matéria nova descobrível pelo
 * mesmo pipeline do `auto-article-cron` (mesmos helpers de
 * `_shared/sourceArticlePicker.ts`, incluindo o 2º hop em páginas de
 * listagem). Só escreve em `event_sources.content_last_verified_at`/
 * `content_last_verified_ok` — nunca toca em `blog_posts`/`ai_generated_posts`.
 * Isolado de propósito do `auto-article-cron`: zero risco pro pipeline já
 * corrigido e validado nesta sessão.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { countNewCandidates } from "./discovery.ts";
import { authorizeAdminOrCron } from "../_shared/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonSuccess(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logToDb(
  supabase: ReturnType<typeof createClient>,
  level: string,
  type: string,
  context: Record<string, unknown>,
) {
  try {
    await supabase.from("application_logs").insert({ level, message: `Verificação semanal de fontes: ${type}`, context });
  } catch (e) {
    console.error("Falha ao salvar log:", e);
  }
}

interface VerifyResult {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  candidatesFound: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

  if (!supabaseUrl || !serviceKey) return jsonError("Configuração do Supabase ausente", 500);
  if (!firecrawlApiKey) return jsonError("FIRECRAWL_API_KEY não configurada", 500);

  const supabase = createClient(supabaseUrl, serviceKey);

  const auth = await authorizeAdminOrCron(req, supabase, {
    anonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    cronSecretRowName: "verify_sources_weekly_cron",
    cronJobHeaderValue: "verify-sources-weekly",
  });
  if (!auth.authorized) return jsonError(auth.message ?? "Não autorizado", auth.status);

  try {
    const { data: sources, error: sourcesError } = await supabase
      .from("event_sources")
      .select("id, name, url")
      .eq("type", "site")
      .eq("enabled", true)
      .eq("content_source", true);

    if (sourcesError) throw sourcesError;
    if (!sources || sources.length === 0) {
      return jsonSuccess({ success: true, checked: 0, message: "Nenhuma fonte de conteúdo habilitada." });
    }

    const { data: usedSourcesRows } = await supabase
      .from("ai_generated_posts")
      .select("source_urls")
      .not("source_urls", "is", null);
    const usedUrls = (usedSourcesRows || []).flatMap((r) => (Array.isArray(r.source_urls) ? r.source_urls : []));

    const results: VerifyResult[] = [];

    for (const source of sources) {
      let candidatesFound = 0;
      try {
        candidatesFound = await countNewCandidates({ url: source.url, name: source.name }, usedUrls, firecrawlApiKey);
      } catch (error) {
        console.error(`[verify-sources-weekly] Falha ao verificar "${source.name}":`, error);
      }

      const ok = candidatesFound > 0;
      results.push({ sourceId: source.id, sourceName: source.name, ok, candidatesFound });

      const { error: updateError } = await supabase
        .from("event_sources")
        .update({ content_last_verified_at: new Date().toISOString(), content_last_verified_ok: ok })
        .eq("id", source.id);
      if (updateError) {
        console.error(`[verify-sources-weekly] Falha ao gravar verificação de "${source.name}":`, updateError);
      }
    }

    const dryCount = results.filter((r) => !r.ok).length;
    await logToDb(supabase, dryCount > 0 ? "warn" : "info", "concluída", {
      checked: results.length,
      dry: dryCount,
      results,
    });

    return jsonSuccess({ success: true, checked: results.length, dry: dryCount, results });
  } catch (error) {
    console.error("[verify-sources-weekly] Erro inesperado:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    await logToDb(supabase, "error", "erro-inesperado", { error: message });
    return jsonError(message, 500);
  }
});
