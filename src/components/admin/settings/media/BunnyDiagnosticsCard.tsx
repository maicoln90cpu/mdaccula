import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Cloud,
  RefreshCw,
  Database,
  Search,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type { BunnyDiagnosis, MigrateFilesResult, CleanupResult } from './types';

interface Props {
  diagLoading: boolean;
  diagResult: BunnyDiagnosis | null;
  onDiagnose: () => void;
  migratingFiles: boolean;
  migrateResult: MigrateFilesResult | null;
  migrateOffset: number;
  onMigrateFiles: () => void;
  onResetOffset: () => void;
  updatingUrls: boolean;
  urlResult: Record<string, number> | null;
  onUpdateUrls: () => void;
  cleaningUp: boolean;
  cleanupResult: CleanupResult | null;
  onCleanupSupabase: () => void;
}

export const BunnyDiagnosticsCard = ({
  diagLoading,
  diagResult,
  onDiagnose,
  migratingFiles,
  migrateResult,
  migrateOffset,
  onMigrateFiles,
  onResetOffset,
  updatingUrls,
  urlResult,
  onUpdateUrls,
  cleaningUp,
  cleanupResult,
  onCleanupSupabase,
}: Props) => {
  const credOk = diagResult?.bunny_config?.auth_ok;

  return (
    <Card className="border-orange-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-orange-500" />
          <CardTitle className="text-lg sm:text-xl">Bunny CDN — Diagnóstico & Migração</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Verifique a configuração, migre arquivos e atualize URLs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <Button onClick={onDiagnose} disabled={diagLoading} variant="outline" className="w-full">
          {diagLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Diagnosticando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Diagnóstico Completo
            </>
          )}
        </Button>

        {diagResult && (
          <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
            <div
              className={`flex items-start gap-2 p-3 rounded-md ${credOk ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'}`}
            >
              {credOk ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {credOk ? 'Credencial Bunny válida' : 'Problema na configuração Bunny'}
                </p>
                <p className="text-xs text-muted-foreground">{diagResult.bunny_config?.hint}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Host: {diagResult.bunny_config?.storage_host} · Zone:{' '}
                  {diagResult.bunny_config?.storage_zone}
                </p>
                {diagResult.bunny_config?.hostname_secret_configured === false && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ Secret BUNNY_STORAGE_HOSTNAME não configurado (usando fallback)
                  </p>
                )}
              </div>
            </div>

            {diagResult.key_diagnostics && (
              <div className="p-3 rounded-md border bg-muted/50 space-y-1">
                <p className="text-sm font-medium mb-1">🔑 Diagnóstico da Chave API</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    Comprimento bruto: <strong>{diagResult.key_diagnostics.rawLength}</strong>
                  </div>
                  <div>
                    Após sanitização:{' '}
                    <strong>{diagResult.key_diagnostics.lengthAfterSanitize}</strong>
                  </div>
                  <div>
                    Aspas no início:{' '}
                    <strong
                      className={
                        diagResult.key_diagnostics.startsWithQuote
                          ? 'text-destructive'
                          : 'text-green-600'
                      }
                    >
                      {diagResult.key_diagnostics.startsWithQuote ? '⚠️ Sim' : 'Não'}
                    </strong>
                  </div>
                  <div>
                    Aspas no final:{' '}
                    <strong
                      className={
                        diagResult.key_diagnostics.endsWithQuote
                          ? 'text-destructive'
                          : 'text-green-600'
                      }
                    >
                      {diagResult.key_diagnostics.endsWithQuote ? '⚠️ Sim' : 'Não'}
                    </strong>
                  </div>
                  <div>
                    Chars invisíveis:{' '}
                    <strong
                      className={
                        diagResult.key_diagnostics.containsNonPrintable
                          ? 'text-destructive'
                          : 'text-green-600'
                      }
                    >
                      {diagResult.key_diagnostics.containsNonPrintable ? '⚠️ Sim' : 'Não'}
                    </strong>
                  </div>
                  <div>
                    Primeiro charCode: <strong>{diagResult.key_diagnostics.firstCharCode}</strong>
                  </div>
                </div>
                {(diagResult.key_diagnostics.startsWithQuote ||
                  diagResult.key_diagnostics.endsWithQuote ||
                  diagResult.key_diagnostics.containsNonPrintable) && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    ⚠️ A chave foi automaticamente sanitizada (aspas/chars removidos)
                  </p>
                )}
                {diagResult.curl_test && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">
                      Teste manual via curl
                    </summary>
                    <code className="block mt-1 p-2 bg-muted rounded text-[10px] break-all">
                      {diagResult.curl_test}
                    </code>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Substitua SUA_STORAGE_ZONE_PASSWORD pela password da aba "FTP & API Access"
                      da zone mdaccula.
                    </p>
                  </details>
                )}
              </div>
            )}

            {diagResult.region_detection && (
              <div
                className={`p-3 rounded-md border ${diagResult.region_detection.detected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-muted/50'}`}
              >
                <p className="text-sm font-medium mb-1">🌍 Detecção de Região</p>
                {diagResult.region_detection.detected ? (
                  <>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✅ Região detectada:{' '}
                      <strong>{diagResult.region_detection.correct_region}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Host correto:{' '}
                      <code className="bg-muted px-1 rounded">
                        {diagResult.region_detection.correct_host}
                      </code>
                    </p>
                    {!credOk && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        👉 {diagResult.region_detection.action_needed}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-destructive">
                    Nenhuma região respondeu. Verifique a password no painel Bunny.
                  </p>
                )}
                {diagResult.region_detection.all_results && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">
                      Ver todas as regiões testadas
                    </summary>
                    <div className="mt-1 space-y-0.5">
                      {diagResult.region_detection.all_results.map((r, i: number) => (
                        <div
                          key={i}
                          className={`text-[10px] font-mono ${r.status === 200 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                        >
                          {r.status === 200 ? '✅' : '❌'} {r.host} ({r.region}) → {r.status}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">📦 Arquivos por bucket:</p>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="font-medium text-muted-foreground">Bucket</div>
                <div className="font-medium text-muted-foreground">Supabase</div>
                <div className="font-medium text-muted-foreground">Tamanho</div>
                <div className="font-medium text-muted-foreground">Bunny</div>
                <div className="font-medium text-muted-foreground">Tamanho</div>
                {Object.keys(diagResult.supabase_buckets || {}).map((bucket) => (
                  <>
                    <div key={`n-${bucket}`} className="font-mono truncate">
                      {bucket}
                    </div>
                    <div key={`s-${bucket}`}>{diagResult.supabase_buckets[bucket]}</div>
                    <div key={`ss-${bucket}`}>
                      {diagResult.supabase_bucket_sizes?.[bucket]?.sizeMB || '—'} MB
                    </div>
                    <div key={`b-${bucket}`}>
                      {credOk ? diagResult.bunny_buckets[bucket] : '—'}
                    </div>
                    <div key={`bs-${bucket}`}>
                      {diagResult.bunny_bucket_sizes?.[bucket]?.sizeMB || '—'} MB
                    </div>
                  </>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">🔗 URLs ainda no Supabase:</p>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {Object.entries(diagResult.unmigrated_urls || {}).map(([key, count]) => (
                  <div
                    key={key}
                    className={`${(count as number) > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}
                  >
                    {key}: <strong>{count as number}</strong>
                  </div>
                ))}
              </div>
              {diagResult.url_dedup && (
                <div className="mt-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                  <p className="font-medium">📊 Análise de duplicatas:</p>
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      Total URLs: <strong>{diagResult.url_dedup.total_urls}</strong>
                    </div>
                    <div>
                      Arquivos únicos: <strong>{diagResult.url_dedup.unique_files}</strong>
                    </div>
                    <div>
                      Referências duplicadas:{' '}
                      <strong>{diagResult.url_dedup.duplicate_references}</strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ℹ️ Vários registros (evento + blog post + link) compartilham a mesma imagem. O
                    número de arquivos no Bunny corresponde aos arquivos únicos, não ao total de
                    URLs.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onMigrateFiles}
            disabled={migratingFiles}
            variant="outline"
            className="flex-1"
          >
            {migratingFiles ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Migrando (offset: {migrateOffset})...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 mr-2" />
                Migrar Arquivos (lote 20)
              </>
            )}
          </Button>
          {migrateOffset > 0 && (
            <Button variant="ghost" size="sm" onClick={onResetOffset} title="Reset offset">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {migrateResult && (
          <div className="p-4 rounded-lg bg-muted/30 border space-y-2 text-xs">
            {migrateResult.hint && (
              <p className="text-destructive font-medium">{migrateResult.hint}</p>
            )}
            {migrateResult.totalMigrated !== undefined && (
              <p className="text-sm font-medium">
                Migrados neste lote: <strong>{migrateResult.totalMigrated}</strong>
              </p>
            )}
            {Object.entries(migrateResult.results || {}).map(([bucket, info]) => (
              <div key={bucket} className="space-y-1">
                <p className="font-medium">
                  {bucket}: {info.migrated} migrados, {info.skipped} existentes, {info.total} total
                </p>
                {info.hasMore && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ⏳ Há mais — clique novamente
                  </p>
                )}
                {info.errors?.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-destructive">
                      {info.errors.length} erros
                    </summary>
                    <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">
                      {info.errors.join('\n')}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        <Button onClick={onUpdateUrls} disabled={updatingUrls} variant="outline" className="w-full">
          {updatingUrls ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Atualizando URLs...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Atualizar URLs no Banco → Bunny CDN
            </>
          )}
        </Button>

        {urlResult && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-1 text-xs">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              ✅ URLs atualizadas!
            </p>
            {Object.entries(urlResult).map(([key, count]) => (
              <div key={key}>
                {key}: <strong>{count}</strong> reescritas
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={onCleanupSupabase}
          disabled={cleaningUp}
          variant="outline"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          {cleaningUp ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verificando e limpando...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Supabase (só após verificação no Bunny)
            </>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground -mt-2">
          Verifica cada arquivo no Bunny CDN (HEAD → 200) antes de deletar do Supabase. Seguro.
        </p>

        {cleanupResult && (
          <div className="p-4 rounded-lg bg-muted/30 border space-y-2 text-xs">
            <p className="text-sm font-medium">🧹 Resultado da limpeza</p>
            {Object.entries(cleanupResult.results || {}).map(([bucket, info]) => (
              <div key={bucket}>
                <span className="font-medium">{bucket}:</span> {info.deleted} deletados,{' '}
                {info.kept} mantidos (não verificados no Bunny)
                {info.errors?.length > 0 && (
                  <span className="text-destructive ml-1">· {info.errors.length} erros</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
