import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageDown, Loader2, Download } from "lucide-react";
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

  return (
    <div className="space-y-4 sm:space-y-6">
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
