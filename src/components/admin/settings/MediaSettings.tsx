import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageDown, Loader2 } from "lucide-react";
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
      toast({
        variant: "destructive",
        title: "Erro na conversão",
        description: error.message,
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
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
            <p className="text-sm">
              Esta ferramenta irá:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Listar todas as imagens PNG/JPG no bucket <code className="bg-muted px-1 rounded">event-images</code></li>
              <li>Converter cada imagem para WebP com qualidade 80%</li>
              <li>Redimensionar imagens maiores que 1024px</li>
              <li>Pular imagens que já possuem versão WebP</li>
            </ul>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ As imagens originais não serão deletadas. Você precisará atualizar as referências no banco de dados manualmente após verificar.
            </p>
          </div>
          
          <Button 
            onClick={handleBatchConvert} 
            disabled={converting}
            className="w-full"
            variant="outline"
          >
            {converting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Convertendo imagens...
              </>
            ) : (
              <>
                <ImageDown className="w-4 h-4 mr-2" />
                Converter Todas as Imagens para WebP
              </>
            )}
          </Button>
          
          {conversionResult && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✅ Conversão concluída!
              </p>
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
