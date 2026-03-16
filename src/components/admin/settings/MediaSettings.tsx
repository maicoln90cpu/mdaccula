import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageDown, Loader2, Download, Cloud, RefreshCw, Database, Search, AlertTriangle, CheckCircle2, Trash2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

type CompressionPreset = "sutil" | "media" | "severa";

const PRESET_LABELS: Record<CompressionPreset, { label: string; desc: string; details: string }> = {
  sutil: { label: "Sutil", desc: "Qualidade alta, resize leve", details: "WebP 85% · max 1920px · ~60-70% menor que PNG (~300KB → ~100KB)" },
  media: { label: "Média", desc: "Equilíbrio qualidade/tamanho", details: "WebP 70% · max 1280px · ~75-85% menor (~300KB → ~55KB)" },
  severa: { label: "Severa", desc: "Máxima compressão", details: "WebP 50% · max 1024px · ~85-92% menor (~300KB → ~30KB)" },
};

const MediaSettings = () => {
  // Bunny diagnosis
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<Record<string, any> | null>(null);

  // Bunny migration
  const [migratingFiles, setMigratingFiles] = useState(false);
  const [migrateResult, setMigrateResult] = useState<Record<string, any> | null>(null);
  const [migrateOffset, setMigrateOffset] = useState(0);
  const [updatingUrls, setUpdatingUrls] = useState(false);
  const [urlResult, setUrlResult] = useState<Record<string, number> | null>(null);

  // Image check
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<Record<string, any> | null>(null);

  // Conversion
  const [converting, setConverting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<CompressionPreset>("media");
  const [conversionResult, setConversionResult] = useState<Record<string, any> | null>(null);

  // Cleanup
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Record<string, any> | null>(null);

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, any> | null>(null);

  const { toast } = useToast();

  // ── Bunny Diagnose ──
  const handleDiagnose = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-bunny", {
        body: { action: "diagnose" },
      });
      if (error) throw error;
      setDiagResult(data);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no diagnóstico", description: error.message });
    } finally {
      setDiagLoading(false);
    }
  };

  // ── Migrate Files ──
  const handleMigrateFiles = async () => {
    setMigratingFiles(true);
    setMigrateResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-bunny", {
        body: { action: "migrate_files", batch_size: 20, offset: migrateOffset },
      });
      if (error) throw error;

      if (data.error) {
        setMigrateResult(data);
        toast({ variant: "destructive", title: "Erro na migração", description: data.credential_hint || data.error });
        return;
      }

      setMigrateResult(data);
      setMigrateOffset(data.nextOffset || 0);
      const hasMore = Object.values(data.results || {}).some((r: any) => r.hasMore);
      toast({
        title: hasMore ? "Lote processado" : "Migração concluída",
        description: `${data.totalMigrated} arquivos migrados.${hasMore ? " Clique novamente." : ""}`,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na migração", description: error.message });
    } finally {
      setMigratingFiles(false);
    }
  };

  // ── Update URLs ──
  const handleUpdateUrls = async () => {
    setUpdatingUrls(true);
    setUrlResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-bunny", {
        body: { action: "update_urls" },
      });
      if (error) throw error;
      setUrlResult(data.updated);
      const total = Object.values(data.updated as Record<string, number>).reduce((a, b) => a + b, 0);
      toast({ title: "URLs atualizadas", description: `${total} URLs reescritas.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar URLs", description: error.message });
    } finally {
      setUpdatingUrls(false);
    }
  };

  // ── Cleanup Supabase (safe delete after Bunny verification) ──
  const handleCleanupSupabase = async () => {
    setCleaningUp(true);
    setCleanupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-bunny", {
        body: { action: "cleanup_supabase" },
      });
      if (error) throw error;
      setCleanupResult(data);
      const total = Object.values(data.results || {}).reduce((a: number, r: any) => a + (r.deleted || 0), 0);
      toast({
        title: "Limpeza concluída",
        description: `${total} arquivos removidos do Supabase após verificação no Bunny.`,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na limpeza", description: error.message });
    } finally {
      setCleaningUp(false);
    }
  };

  // ── Check (multi-bucket) ──
  const handleCheck = async () => {
    setCheckLoading(true);
    setCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("batch-convert-webp", {
        body: { action: "check", bucket: "all" },
      });
      if (error) throw error;
      setCheckResult(data);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na análise", description: error.message });
    } finally {
      setCheckLoading(false);
    }
  };

  // ── Convert (multi-bucket) ──
  const handleConvert = async () => {
    setConverting(true);
    setConversionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("batch-convert-webp", {
        body: { action: "convert", bucket: "all", preset: selectedPreset, maxFiles: 2 },
      });
      if (error) throw error;
      setConversionResult(data);
      toast({
        title: "Conversão concluída",
        description: `${data.summary.processed} imagens. ${data.summary.totalSavedMB} MB economizados.`,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na conversão", description: error.message });
    } finally {
      setConverting(false);
    }
  };

  // ── Import Storage ──
  const handleImportStorage = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-storage");
      if (error) throw error;
      setImportResult(data);
      toast({
        title: data.complete ? "Importação completa!" : "Lote processado",
        description: data.message,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: error.message });
    } finally {
      setImporting(false);
    }
  };

  const credOk = diagResult?.bunny_config?.auth_ok;

  // Calculate economy dashboard from diagnosis data
  const supabaseTotalMB = diagResult?.supabase_bucket_sizes
    ? Object.values(diagResult.supabase_bucket_sizes).reduce((sum: number, b: any) => sum + parseFloat(b.sizeMB || "0"), 0)
    : 0;
  const bunnyTotalMB = diagResult?.bunny_bucket_sizes
    ? Object.values(diagResult.bunny_bucket_sizes).reduce((sum: number, b: any) => sum + parseFloat(b.sizeMB || "0"), 0)
    : 0;
  const bunnyTotalFiles = diagResult?.bunny_bucket_sizes
    ? Object.values(diagResult.bunny_bucket_sizes).reduce((sum: number, b: any) => sum + (b.count || 0), 0)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ═══ Economy Dashboard ═══ */}
      {diagResult && (credOk || diagResult.bunny_bucket_sizes) && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="px-4 sm:px-6 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              <CardTitle className="text-lg sm:text-xl">Dashboard de Economia</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-background border text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{bunnyTotalFiles as number}</div>
                <div className="text-[10px] text-muted-foreground">Imagens no Bunny</div>
              </div>
              <div className="p-3 rounded-lg bg-background border text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{(bunnyTotalMB as number).toFixed(1)} MB</div>
                <div className="text-[10px] text-muted-foreground">Armazenado no Bunny</div>
              </div>
              <div className="p-3 rounded-lg bg-background border text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(supabaseTotalMB as number).toFixed(1)} MB</div>
                <div className="text-[10px] text-muted-foreground">Restante no Supabase</div>
              </div>
              <div className="p-3 rounded-lg bg-background border text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">~${((bunnyTotalMB as number) * 0.01 / 1024).toFixed(3)}</div>
                <div className="text-[10px] text-muted-foreground">Custo Bunny/mês (est.)</div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Economia vs Supabase egress: ~${(((bunnyTotalMB as number) / 1024) * 0.09).toFixed(2)}/GB servido vs ~${(((bunnyTotalMB as number) / 1024) * 0.01).toFixed(3)}/GB no Bunny
            </p>
          </CardContent>
        </Card>
      )}

      {/* ═══ Bunny CDN Diagnostics & Migration ═══ */}
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

          {/* Diagnose */}
          <Button onClick={handleDiagnose} disabled={diagLoading} variant="outline" className="w-full">
            {diagLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Diagnosticando...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" />Diagnóstico Completo</>
            )}
          </Button>

          {diagResult && (
            <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
              {/* Credential status */}
              <div className={`flex items-start gap-2 p-3 rounded-md ${credOk ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30"}`}>
                {credOk ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{credOk ? "Credencial Bunny válida" : "Problema na configuração Bunny"}</p>
                  <p className="text-xs text-muted-foreground">{diagResult.bunny_config?.hint}</p>
                  <p className="text-xs text-muted-foreground mt-1">Host: {diagResult.bunny_config?.storage_host} · Zone: {diagResult.bunny_config?.storage_zone}</p>
                  {diagResult.bunny_config?.hostname_secret_configured === false && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Secret BUNNY_STORAGE_HOSTNAME não configurado (usando fallback)</p>
                  )}
                </div>
              </div>

              {/* Key diagnostics */}
              {diagResult.key_diagnostics && (
                <div className="p-3 rounded-md border bg-muted/50 space-y-1">
                  <p className="text-sm font-medium mb-1">🔑 Diagnóstico da Chave API</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>Comprimento bruto: <strong>{diagResult.key_diagnostics.rawLength}</strong></div>
                    <div>Após sanitização: <strong>{diagResult.key_diagnostics.lengthAfterSanitize}</strong></div>
                    <div>Aspas no início: <strong className={diagResult.key_diagnostics.startsWithQuote ? "text-destructive" : "text-green-600"}>{diagResult.key_diagnostics.startsWithQuote ? "⚠️ Sim" : "Não"}</strong></div>
                    <div>Aspas no final: <strong className={diagResult.key_diagnostics.endsWithQuote ? "text-destructive" : "text-green-600"}>{diagResult.key_diagnostics.endsWithQuote ? "⚠️ Sim" : "Não"}</strong></div>
                    <div>Chars invisíveis: <strong className={diagResult.key_diagnostics.containsNonPrintable ? "text-destructive" : "text-green-600"}>{diagResult.key_diagnostics.containsNonPrintable ? "⚠️ Sim" : "Não"}</strong></div>
                    <div>Primeiro charCode: <strong>{diagResult.key_diagnostics.firstCharCode}</strong></div>
                  </div>
                  {(diagResult.key_diagnostics.startsWithQuote || diagResult.key_diagnostics.endsWithQuote || diagResult.key_diagnostics.containsNonPrintable) && (
                    <p className="text-xs text-destructive font-medium mt-1">⚠️ A chave foi automaticamente sanitizada (aspas/chars removidos)</p>
                  )}
                  {diagResult.curl_test && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-muted-foreground">Teste manual via curl</summary>
                      <code className="block mt-1 p-2 bg-muted rounded text-[10px] break-all">{diagResult.curl_test}</code>
                      <p className="text-[10px] text-muted-foreground mt-1">Substitua SUA_STORAGE_ZONE_PASSWORD pela password da aba "FTP & API Access" da zone mdaccula.</p>
                    </details>
                  )}
                </div>
              )}

              {/* Region detection */}
              {diagResult.region_detection && (
                <div className={`p-3 rounded-md border ${diagResult.region_detection.detected ? "bg-blue-500/10 border-blue-500/30" : "bg-muted/50"}`}>
                  <p className="text-sm font-medium mb-1">🌍 Detecção de Região</p>
                  {diagResult.region_detection.detected ? (
                    <>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✅ Região detectada: <strong>{diagResult.region_detection.correct_region}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Host correto: <code className="bg-muted px-1 rounded">{diagResult.region_detection.correct_host}</code>
                      </p>
                      {!credOk && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                          👉 {diagResult.region_detection.action_needed}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-destructive">Nenhuma região respondeu. Verifique a password no painel Bunny.</p>
                  )}
                  {diagResult.region_detection.all_results && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-muted-foreground">Ver todas as regiões testadas</summary>
                      <div className="mt-1 space-y-0.5">
                        {diagResult.region_detection.all_results.map((r: any, i: number) => (
                          <div key={i} className={`text-[10px] font-mono ${r.status === 200 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                            {r.status === 200 ? "✅" : "❌"} {r.host} ({r.region}) → {r.status}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Bucket comparison with sizes */}
              <div>
                <p className="text-sm font-medium mb-2">📦 Arquivos por bucket:</p>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <div className="font-medium text-muted-foreground">Bucket</div>
                  <div className="font-medium text-muted-foreground">Supabase</div>
                  <div className="font-medium text-muted-foreground">Tamanho</div>
                  <div className="font-medium text-muted-foreground">Bunny</div>
                  <div className="font-medium text-muted-foreground">Tamanho</div>
                  {Object.keys(diagResult.supabase_buckets || {}).map(bucket => (
                    <>
                      <div key={`n-${bucket}`} className="font-mono truncate">{bucket}</div>
                      <div key={`s-${bucket}`}>{diagResult.supabase_buckets[bucket]}</div>
                      <div key={`ss-${bucket}`}>{diagResult.supabase_bucket_sizes?.[bucket]?.sizeMB || "—"} MB</div>
                      <div key={`b-${bucket}`}>{credOk ? diagResult.bunny_buckets[bucket] : "—"}</div>
                      <div key={`bs-${bucket}`}>{diagResult.bunny_bucket_sizes?.[bucket]?.sizeMB || "—"} MB</div>
                    </>
                  ))}
                </div>
              </div>

              {/* Unmigrated URLs */}
              <div>
                <p className="text-sm font-medium mb-1">🔗 URLs ainda no Supabase:</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(diagResult.unmigrated_urls || {}).map(([key, count]) => (
                    <div key={key} className={`${(count as number) > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                      {key}: <strong>{count as number}</strong>
                    </div>
                  ))}
                </div>
                {diagResult.url_dedup && (
                  <div className="mt-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                    <p className="font-medium">📊 Análise de duplicatas:</p>
                    <div className="grid grid-cols-3 gap-1">
                      <div>Total URLs: <strong>{diagResult.url_dedup.total_urls}</strong></div>
                      <div>Arquivos únicos: <strong>{diagResult.url_dedup.unique_files}</strong></div>
                      <div>Referências duplicadas: <strong>{diagResult.url_dedup.duplicate_references}</strong></div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      ℹ️ Vários registros (evento + blog post + link) compartilham a mesma imagem. 
                      O número de arquivos no Bunny corresponde aos arquivos únicos, não ao total de URLs.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Migrate files */}
          <div className="flex gap-2">
            <Button onClick={handleMigrateFiles} disabled={migratingFiles} variant="outline" className="flex-1">
              {migratingFiles ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Migrando (offset: {migrateOffset})...</>
              ) : (
                <><Cloud className="w-4 h-4 mr-2" />Migrar Arquivos (lote 20)</>
              )}
            </Button>
            {migrateOffset > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMigrateOffset(0)} title="Reset offset">
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
                <p className="text-sm font-medium">Migrados neste lote: <strong>{migrateResult.totalMigrated}</strong></p>
              )}
              {Object.entries(migrateResult.results || {}).map(([bucket, info]: [string, any]) => (
                <div key={bucket} className="space-y-1">
                  <p className="font-medium">{bucket}: {info.migrated} migrados, {info.skipped} existentes, {info.total} total</p>
                  {info.hasMore && <p className="text-amber-600 dark:text-amber-400">⏳ Há mais — clique novamente</p>}
                  {info.errors?.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-destructive">{info.errors.length} erros</summary>
                      <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">{info.errors.join("\n")}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Update URLs */}
          <Button onClick={handleUpdateUrls} disabled={updatingUrls} variant="outline" className="w-full">
            {updatingUrls ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Atualizando URLs...</>
            ) : (
              <><Database className="w-4 h-4 mr-2" />Atualizar URLs no Banco → Bunny CDN</>
            )}
          </Button>

          {urlResult && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-1 text-xs">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">✅ URLs atualizadas!</p>
              {Object.entries(urlResult).map(([key, count]) => (
                <div key={key}>{key}: <strong>{count}</strong> reescritas</div>
              ))}
            </div>
          )}

          {/* Cleanup Supabase (safe delete) */}
          <Button onClick={handleCleanupSupabase} disabled={cleaningUp} variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10">
            {cleaningUp ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando e limpando...</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" />Limpar Supabase (só após verificação no Bunny)</>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground -mt-2">
            Verifica cada arquivo no Bunny CDN (HEAD → 200) antes de deletar do Supabase. Seguro.
          </p>

          {cleanupResult && (
            <div className="p-4 rounded-lg bg-muted/30 border space-y-2 text-xs">
              <p className="text-sm font-medium">🧹 Resultado da limpeza</p>
              {Object.entries(cleanupResult.results || {}).map(([bucket, info]: [string, any]) => (
                <div key={bucket}>
                  <span className="font-medium">{bucket}:</span> {info.deleted} deletados, {info.kept} mantidos (não verificados no Bunny)
                  {info.errors?.length > 0 && (
                    <span className="text-destructive ml-1">· {info.errors.length} erros</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Image Optimization ═══ */}
      <Card className="border-green-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ImageDown className="w-5 h-5 text-green-500" />
            <CardTitle className="text-lg sm:text-xl">Otimização de Imagens</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Analise o acervo de todos os buckets e converta imagens com upload direto para o Bunny
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">

          {/* Check */}
          <Button onClick={handleCheck} disabled={checkLoading} variant="outline" className="w-full">
            {checkLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando todos os buckets...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" />Analisar Acervo (todos os buckets)</>
            )}
          </Button>

          {checkResult && (
            <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Total arquivos: <strong>{checkResult.totalFiles}</strong></div>
                <div>Imagens: <strong>{checkResult.totalImages}</strong></div>
                <div>No Bunny: <strong>{checkResult.bunnyImages >= 0 ? checkResult.bunnyImages : "N/A"}</strong></div>
                <div>Tamanho total: <strong>{checkResult.totalMB} MB</strong></div>
                <div className="col-span-2">Média por imagem: <strong>{checkResult.avgMB} MB</strong></div>
              </div>

              {/* Per-bucket details */}
              {checkResult.bucketDetails && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Por bucket:</p>
                  {Object.entries(checkResult.bucketDetails).map(([bucket, info]: [string, any]) => (
                    <div key={bucket} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{bucket}:</span>
                      <span>{info.images} imagens · {info.sizeMB} MB</span>
                      <span className="text-muted-foreground">· Bunny: {info.bunnyCount}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium">Distribuição por tamanho:</p>
                {Object.entries(checkResult.breakdown || {}).map(([key, info]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${key === "small" ? "bg-green-500" : key === "medium" ? "bg-amber-500" : "bg-red-500"}`} />
                    <span className="text-muted-foreground">{info.label}:</span>
                    <strong>{info.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Nível de compressão:</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRESET_LABELS) as CompressionPreset[]).map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedPreset(key)}
                  className={`p-2 rounded-md border text-xs text-center transition-colors ${
                    selectedPreset === key
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium">{PRESET_LABELS[key].label}</div>
                  <div className="text-[10px] text-muted-foreground">{PRESET_LABELS[key].desc}</div>
                  <div className="text-[9px] text-muted-foreground/70 mt-0.5">{PRESET_LABELS[key].details}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Convert */}
          <Button onClick={handleConvert} disabled={converting} variant="outline" className="w-full">
            {converting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Convertendo ({PRESET_LABELS[selectedPreset].label})...</>
            ) : (
              <><ImageDown className="w-4 h-4 mr-2" />Converter Imagens → Bunny ({PRESET_LABELS[selectedPreset].label})</>
            )}
          </Button>

          {conversionResult && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2 text-xs">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">✅ Conversão concluída!</p>
              <p className="text-muted-foreground">Preset: {conversionResult.preset?.label} · Buckets: {conversionResult.buckets?.join(", ")}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Convertidas: <strong>{conversionResult.summary?.processed}</strong></div>
                <div>Sem ganho: <strong>{conversionResult.summary?.skipped}</strong></div>
                <div>Erros: <strong>{conversionResult.summary?.errors}</strong></div>
                <div className="col-span-2">Economizado: <strong>{conversionResult.summary?.totalSavedMB} MB</strong></div>
              </div>
              {conversionResult.details?.processed?.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-green-600 dark:text-green-400">Ver convertidas</summary>
                  <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">{conversionResult.details.processed.join("\n")}</pre>
                </details>
              )}
              {conversionResult.details?.errors?.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-destructive">Ver erros</summary>
                  <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">{conversionResult.details.errors.join("\n")}</pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Import from old project ═══ */}
      <Card className="border-blue-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-lg sm:text-xl">Importar do Projeto Antigo</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Importa imagens do storage do projeto Supabase anterior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Processa até 30 arquivos por execução. Clique várias vezes até completar.
          </p>
          <Button onClick={handleImportStorage} disabled={importing} className="w-full" variant="outline">
            {importing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />Importar Arquivos</>
            )}
          </Button>

          {importResult && (
            <div className={`p-4 rounded-lg border space-y-2 text-xs ${importResult.complete ? "bg-green-500/10 border-green-500/30" : "bg-blue-500/10 border-blue-500/30"}`}>
              <p className={`text-sm font-medium ${importResult.complete ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                {importResult.complete ? "✅ Completo!" : "⏳ Execute novamente"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>Total: <strong>{importResult.totalFiles}</strong></div>
                <div>Importados: <strong>{importResult.imported}</strong></div>
                <div>Existentes: <strong>{importResult.skipped}</strong></div>
                <div>Erros: <strong>{importResult.errors}</strong></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaSettings;
