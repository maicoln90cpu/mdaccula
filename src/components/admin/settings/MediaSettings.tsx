import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageDown, Loader2, Download, Cloud, RefreshCw, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

const MediaSettings = () => {
  const [converting, setConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<{
    converted: number;
    skipped: number;
    largeFilesSkipped: number;
    errors: number;
    totalSavedMB: string;
  } | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    totalFiles: number;
    imported: number;
    skipped: number;
    errors: number;
    complete: boolean;
    message: string;
    errorDetails?: string[];
  } | null>(null);

  // Bunny migration state
  const [bunnyStatus, setBunnyStatus] = useState<Record<string, any> | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [migratingFiles, setMigratingFiles] = useState(false);
  const [migrateResult, setMigrateResult] = useState<Record<string, any> | null>(null);
  const [migrateOffset, setMigrateOffset] = useState(0);
  const [updatingUrls, setUpdatingUrls] = useState(false);
  const [urlResult, setUrlResult] = useState<Record<string, number> | null>(null);

  const { toast } = useToast();

  const handleBatchConvert = async () => {
    setConverting(true);
    setConversionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("batch-convert-webp", {
        body: { bucket: "event-images", quality: 80 },
      });
      if (error) throw error;
      if (data.success) {
        setConversionResult(data.summary);
        toast({
          title: "Conversão concluída",
          description: `${data.summary.converted} imagens convertidas. ${data.summary.totalSavedMB} MB economizados.`,
        });
      } else {
        throw new Error(data.error || "Conversion failed");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na conversão", description: error.message });
    } finally {
      setConverting(false);
    }
  };

  const handleImportStorage = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-storage");
      if (error) throw error;
      if (data.success) {
        setImportResult(data);
        toast({
          title: data.complete ? "Importação completa!" : "Lote processado",
          description: data.message,
        });
      } else {
        throw new Error(data.error || "Import failed");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: error.message });
    } finally {
      setImporting(false);
    }
  };

  // Bunny migration handlers
  const handleBunnyStatus = async () => {
    setLoadingStatus(true);
    setBunnyStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-bunny", {
        body: { action: "status" },
      });
      if (error) throw error;
      setBunnyStatus(data.status);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao verificar status", description: error.message });
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleMigrateFiles = async () => {
    setMigratingFiles(true);
    setMigrateResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-bunny", {
        body: { action: "migrate_files", batch_size: 20, offset: migrateOffset },
      });
      if (error) throw error;
      setMigrateResult(data);
      setMigrateOffset(data.nextOffset || 0);

      const hasMore = Object.values(data.results || {}).some((r: any) => r.hasMore);
      toast({
        title: hasMore ? "Lote processado" : "Migração concluída",
        description: `${data.totalMigrated} arquivos migrados neste lote.${hasMore ? " Clique novamente para continuar." : ""}`,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na migração", description: error.message });
    } finally {
      setMigratingFiles(false);
    }
  };

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
      toast({
        title: "URLs atualizadas",
        description: `${total} URLs reescritas para Bunny CDN.`,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar URLs", description: error.message });
    } finally {
      setUpdatingUrls(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Bunny CDN Migration */}
      <Card className="border-orange-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-lg sm:text-xl">Migração Bunny CDN</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Migre imagens do Supabase Storage para o Bunny CDN e atualize as URLs no banco
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          {/* Step 1: Status */}
          <div className="space-y-2">
            <Button onClick={handleBunnyStatus} disabled={loadingStatus} variant="outline" className="w-full">
              {loadingStatus ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Ver Status da Migração</>
              )}
            </Button>

            {bunnyStatus && (
              <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                <p className="text-sm font-medium">📦 Arquivos por bucket:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(bunnyStatus.buckets || {}).map(([bucket, count]) => (
                    <div key={bucket}>{bucket}: <strong>{count as number}</strong></div>
                  ))}
                </div>
                <p className="text-sm font-medium mt-2">🔗 URLs ainda no Supabase:</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(bunnyStatus.urls || {}).map(([key, count]) => (
                    <div key={key} className={`${(count as number) > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                      {key}: <strong>{count as number}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Migrate files */}
          <div className="space-y-2">
            <Button onClick={handleMigrateFiles} disabled={migratingFiles} variant="outline" className="w-full">
              {migratingFiles ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Migrando arquivos (offset: {migrateOffset})...</>
              ) : (
                <><Cloud className="w-4 h-4 mr-2" />Migrar Arquivos para Bunny (lote de 20)</>
              )}
            </Button>

            {migrateResult && (
              <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
                <p className="text-sm font-medium">Migrados neste lote: <strong>{migrateResult.totalMigrated}</strong></p>
                {Object.entries(migrateResult.results || {}).map(([bucket, info]: [string, any]) => (
                  <div key={bucket} className="text-xs space-y-1">
                    <p className="font-medium">{bucket}:</p>
                    <div className="grid grid-cols-3 gap-1 pl-2">
                      <div>Migrados: {info.migrated}</div>
                      <div>Já existentes: {info.skipped}</div>
                      <div>Total: {info.total}</div>
                    </div>
                    {info.hasMore && (
                      <p className="text-amber-600 dark:text-amber-400 text-xs">⏳ Há mais arquivos — clique novamente</p>
                    )}
                    {info.errors?.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-destructive">{info.errors.length} erros</summary>
                        <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">{info.errors.join('\n')}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Update URLs */}
          <div className="space-y-2">
            <Button onClick={handleUpdateUrls} disabled={updatingUrls} variant="outline" className="w-full">
              {updatingUrls ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Atualizando URLs no banco...</>
              ) : (
                <><Database className="w-4 h-4 mr-2" />Atualizar URLs no Banco → Bunny CDN</>
              )}
            </Button>

            {urlResult && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">✅ URLs atualizadas!</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(urlResult).map(([key, count]) => (
                    <div key={key}>{key}: <strong>{count}</strong> URLs reescritas</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import from old project */}
      <Card className="border-blue-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-lg sm:text-xl">Importar do Projeto Antigo</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Importa imagens do storage do projeto Supabase anterior (220 arquivos em 3 buckets)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
            <p className="text-xs text-muted-foreground">
              Processa até 30 arquivos por execução (limite de timeout). Clique várias vezes até completar. Arquivos existentes são ignorados.
            </p>
          </div>

          <Button onClick={handleImportStorage} disabled={importing} className="w-full" variant="outline">
            {importing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando arquivos...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />Importar Arquivos do Projeto Antigo</>
            )}
          </Button>

          {importResult && (
            <div className={`p-4 rounded-lg border space-y-2 ${importResult.complete ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
              <p className={`text-sm font-medium ${importResult.complete ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {importResult.complete ? '✅ Importação completa!' : '⏳ Lote processado — execute novamente'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Total: <strong>{importResult.totalFiles}</strong></div>
                <div>Importados: <strong>{importResult.imported}</strong></div>
                <div>Já existentes: <strong>{importResult.skipped}</strong></div>
                <div>Erros: <strong>{importResult.errors}</strong></div>
              </div>
              {importResult.errorDetails && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-destructive">Ver erros</summary>
                  <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-32">{importResult.errorDetails.join('\n')}</pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WebP conversion */}
      <Card className="border-green-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ImageDown className="w-5 h-5 text-green-500" />
            <CardTitle className="text-lg sm:text-xl">Otimização de Imagens</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Converta imagens PNG/JPG existentes para WebP (economiza ~70% de espaço)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
            <p className="text-sm">Esta ferramenta irá:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Listar todas as imagens PNG/JPG no bucket <code className="bg-muted px-1 rounded">event-images</code></li>
              <li>Converter cada imagem para WebP com qualidade 80%</li>
              <li>Redimensionar imagens maiores que 1024px</li>
              <li>Pular imagens que já possuem versão WebP</li>
            </ul>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ As imagens originais não serão deletadas.
            </p>
          </div>
          <Button onClick={handleBatchConvert} disabled={converting} className="w-full" variant="outline">
            {converting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Convertendo imagens...</>
            ) : (
              <><ImageDown className="w-4 h-4 mr-2" />Converter Todas as Imagens para WebP</>
            )}
          </Button>
          {conversionResult && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">✅ Conversão concluída!</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Convertidas: <strong>{conversionResult.converted}</strong></div>
                <div>Ignoradas: <strong>{conversionResult.skipped}</strong></div>
                <div>Grandes (&gt;2MB): <strong>{conversionResult.largeFilesSkipped}</strong></div>
                <div>Erros: <strong>{conversionResult.errors}</strong></div>
                <div className="col-span-2">Economizado: <strong>{conversionResult.totalSavedMB} MB</strong></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaSettings;
